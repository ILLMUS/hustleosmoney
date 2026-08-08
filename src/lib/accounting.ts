import { supabase } from '@/integrations/supabase/client';
import { QuoteDocument, calculateSubtotal, calculateCostTotal, CostItem } from '@/types/document';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface Account {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string | null;
  vat_rate: number;
  is_system: boolean;
  is_archived: boolean;
}

export interface JournalLine {
  id: string;
  entry_id: string;
  account_id: string;
  description: string;
  debit: number;
  credit: number;
  vat_amount: number;
}

export interface JournalEntry {
  id: string;
  entry_date: string;
  memo: string;
  reference: string | null;
  contact_name: string | null;
  source_type: string;
  source_id: string | null;
  is_reconciled: boolean;
  reconciled_at: string | null;
  created_at: string;
  voucher_type: VoucherType;
  voucher_number: string | null;
  cost_center: string | null;
}

export type VoucherType = 'payment' | 'receipt' | 'sales' | 'purchase' | 'contra' | 'journal';

export const VOUCHER_TYPES: { value: VoucherType; label: string; prefix: string; hint: string }[] = [
  { value: 'payment', label: 'Payment voucher', prefix: 'PV', hint: 'Money paid out — suppliers, wages, expenses.' },
  { value: 'receipt', label: 'Receipt voucher', prefix: 'RV', hint: 'Money received into the bank or cash box.' },
  { value: 'sales', label: 'Sales voucher', prefix: 'SV', hint: 'Invoiced sales on credit.' },
  { value: 'purchase', label: 'Purchase voucher', prefix: 'PUV', hint: 'Bills and purchases on credit.' },
  { value: 'contra', label: 'Contra voucher', prefix: 'CV', hint: 'Transfers between bank, cash and reserve.' },
  { value: 'journal', label: 'Journal voucher', prefix: 'JV', hint: 'Adjustments, corrections and accruals.' },
];

export const voucherLabel = (t: string) =>
  VOUCHER_TYPES.find(v => v.value === t)?.label ?? 'Journal voucher';

export async function nextVoucherNumber(voucherType: VoucherType): Promise<string | null> {
  const { data, error } = await supabase.rpc('next_voucher_number' as never, { _voucher_type: voucherType } as never);
  if (error) return null;
  return (data as unknown as string) ?? null;
}

export interface VatSettings {
  vat_registered: boolean;
  vat_rate: number;
  accounting_basis: string;
}

export const money = (n: number) =>
  `E${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};

/** Debit-positive types. Credit-positive types are the inverse. */
const DEBIT_POSITIVE: AccountType[] = ['asset', 'expense'];

export function signedBalance(type: AccountType, debit: number, credit: number) {
  return DEBIT_POSITIVE.includes(type) ? debit - credit : credit - debit;
}

export async function loadAccounting(userId: string) {
  const [{ data: accounts }, { data: entries }, { data: lines }] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).order('code'),
    supabase.from('journal_entries').select('*').eq('user_id', userId).order('entry_date', { ascending: false }),
    supabase.from('journal_lines').select('*').eq('user_id', userId),
  ]);
  return {
    accounts: (accounts ?? []) as unknown as Account[],
    entries: (entries ?? []) as unknown as JournalEntry[],
    lines: (lines ?? []) as unknown as JournalLine[],
  };
}

export async function ensureChartOfAccounts(userId: string) {
  const { count } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) === 0) {
    await supabase.rpc('seed_chart_of_accounts');
  }
}

export function accountByCode(accounts: Account[], code: string) {
  return accounts.find(a => a.code === code) ?? null;
}

const COST_ACCOUNT_CODE: Record<string, string> = {
  labour: '5000',
  services: '5100',
  other: '5200',
  margin: '5300',
};

export interface DraftLine {
  account_id: string;
  description: string;
  debit: number;
  credit: number;
  vat_amount?: number;
}

export function linesBalanced(lines: { debit: number; credit: number }[]) {
  const d = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const c = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  return { debit: d, credit: c, balanced: d === c && d > 0 };
}

export async function createJournalEntry(
  userId: string,
  header: {
    entry_date: string;
    memo: string;
    reference?: string | null;
    contact_name?: string | null;
    source_type?: string;
    source_id?: string | null;
    voucher_type?: VoucherType;
    voucher_number?: string | null;
    cost_center?: string | null;
  },
  lines: DraftLine[],
) {
  const voucherType: VoucherType = header.voucher_type ?? 'journal';
  const voucherNumber = header.voucher_number ?? (await nextVoucherNumber(voucherType));
  const { data: entry, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: userId,
      entry_date: header.entry_date,
      memo: header.memo,
      reference: header.reference ?? null,
      contact_name: header.contact_name ?? null,
      source_type: header.source_type ?? 'manual',
      source_id: header.source_id ?? null,
      voucher_type: voucherType,
      voucher_number: voucherNumber,
      cost_center: header.cost_center ?? null,
    } as never)
    .select()
    .single();
  if (error || !entry) throw error ?? new Error('Could not create entry');

  const payload = lines
    .filter(l => l.account_id && (l.debit || l.credit))
    .map(l => ({
      user_id: userId,
      entry_id: entry.id,
      account_id: l.account_id,
      description: l.description ?? '',
      debit: round2(l.debit),
      credit: round2(l.credit),
      vat_amount: round2(l.vat_amount ?? 0),
    }));
  const { data: created, error: lineErr } = await supabase.from('journal_lines').insert(payload).select();
  if (lineErr) throw lineErr;
  return { entry: entry as unknown as JournalEntry, lines: (created ?? []) as unknown as JournalLine[] };
}

/**
 * Build the double-entry lines for a receipt.
 * Sales side: Dr Bank (gross) / Cr Sales (net) / Cr VAT output.
 * Job cost side: Dr cost accounts / Cr Bank.
 */
export function buildReceiptLines(
  doc: QuoteDocument,
  accounts: Account[],
  vat: VatSettings,
): DraftLine[] {
  const bank = accountByCode(accounts, '1000');
  const sales = accountByCode(accounts, '4000');
  const vatOut = accountByCode(accounts, '2100');
  if (!bank || !sales) return [];

  const subtotal = round2(calculateSubtotal(doc.items ?? []));
  const docTax = round2(subtotal * ((doc.taxRate || 0) / 100));
  const gross = round2(subtotal + docTax);
  const vatAmount = vat.vat_registered ? docTax : 0;
  const net = round2(gross - vatAmount);

  const lines: DraftLine[] = [
    { account_id: bank.id, description: `Receipt ${doc.receiptNumber ?? ''}`.trim(), debit: gross, credit: 0 },
    { account_id: sales.id, description: doc.title || 'Sales', debit: 0, credit: net, vat_amount: vatAmount },
  ];
  if (vatAmount > 0 && vatOut) {
    lines.push({ account_id: vatOut.id, description: 'VAT on sales', debit: 0, credit: vatAmount, vat_amount: vatAmount });
  }

  const costItems: CostItem[] = doc.costItems ?? [];
  const costTotal = round2(calculateCostTotal(costItems));
  if (costTotal > 0) {
    costItems.forEach(ci => {
      const acc = accountByCode(accounts, COST_ACCOUNT_CODE[ci.category] ?? '5200');
      if (!acc || !ci.amount) return;
      lines.push({
        account_id: acc.id,
        description: ci.description || ci.category,
        debit: round2(ci.amount),
        credit: 0,
      });
    });
    lines.push({ account_id: bank.id, description: 'Job costs paid', debit: 0, credit: costTotal });
  }
  return lines;
}

export async function postReceipts(
  userId: string,
  docs: QuoteDocument[],
  accounts: Account[],
  vat: VatSettings,
  alreadyPosted: Set<string>,
) {
  let posted = 0;
  for (const doc of docs) {
    if (doc.type !== 'receipt' || alreadyPosted.has(doc.id)) continue;
    const lines = buildReceiptLines(doc, accounts, vat);
    if (lines.length === 0) continue;
    await createJournalEntry(
      userId,
      {
        entry_date: (doc.issueDate ?? doc.createdAt).slice(0, 10),
        memo: `Receipt ${doc.receiptNumber ?? ''} — ${doc.clientInfo?.name ?? 'Client'}`.trim(),
        reference: doc.receiptNumber ?? doc.invoiceNumber ?? doc.quoteNumber,
        contact_name: doc.clientInfo?.name ?? null,
        source_type: 'receipt',
        source_id: doc.id,
        voucher_type: 'receipt',
        cost_center: doc.clientInfo?.name ?? null,
      },
      lines,
    );
    posted++;
  }
  return posted;
}

/* ---------------- Reporting ---------------- */

export interface AccountTotals {
  account: Account;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerFilters {
  from?: string;
  to?: string;
  voucherTypes?: string[];
  contact?: string;
  costCenter?: string;
}

export function filterEntries(entries: JournalEntry[], filters: LedgerFilters = {}) {
  return entries.filter(e => {
    if (filters.from && e.entry_date < filters.from) return false;
    if (filters.to && e.entry_date > filters.to) return false;
    if (filters.voucherTypes?.length && !filters.voucherTypes.includes(e.voucher_type ?? 'journal')) return false;
    if (filters.contact && (e.contact_name ?? '') !== filters.contact) return false;
    if (filters.costCenter && (e.cost_center ?? '') !== filters.costCenter) return false;
    return true;
  });
}

export function uniqueContacts(entries: JournalEntry[]) {
  return Array.from(new Set(entries.map(e => e.contact_name).filter(Boolean) as string[])).sort();
}

export function uniqueCostCenters(entries: JournalEntry[]) {
  return Array.from(new Set(entries.map(e => e.cost_center).filter(Boolean) as string[])).sort();
}

export function accountTotals(
  accounts: Account[],
  lines: JournalLine[],
  entries: JournalEntry[],
  filters?: LedgerFilters,
): AccountTotals[] {
  const allowed = new Set(filterEntries(entries, filters ?? {}).map(e => e.id));
  const inRange = (l: JournalLine) => allowed.has(l.entry_id);
  return accounts.map(account => {
    const own = lines.filter(l => l.account_id === account.id && inRange(l));
    const debit = round2(own.reduce((s, l) => s + Number(l.debit), 0));
    const credit = round2(own.reduce((s, l) => s + Number(l.credit), 0));
    return { account, debit, credit, balance: round2(signedBalance(account.type, debit, credit)) };
  });
}

export function profitAndLoss(totals: AccountTotals[]) {
  const income = totals.filter(t => t.account.type === 'income');
  const expenses = totals.filter(t => t.account.type === 'expense');
  const incomeTotal = round2(income.reduce((s, t) => s + t.balance, 0));
  const expenseTotal = round2(expenses.reduce((s, t) => s + t.balance, 0));
  return { income, expenses, incomeTotal, expenseTotal, netProfit: round2(incomeTotal - expenseTotal) };
}

export function balanceSheet(totals: AccountTotals[], netProfit: number) {
  const assets = totals.filter(t => t.account.type === 'asset');
  const liabilities = totals.filter(t => t.account.type === 'liability');
  const equity = totals.filter(t => t.account.type === 'equity');
  const assetTotal = round2(assets.reduce((s, t) => s + t.balance, 0));
  const liabilityTotal = round2(liabilities.reduce((s, t) => s + t.balance, 0));
  const equityTotal = round2(equity.reduce((s, t) => s + t.balance, 0) + netProfit);
  return {
    assets, liabilities, equity,
    assetTotal, liabilityTotal, equityTotal,
    difference: round2(assetTotal - (liabilityTotal + equityTotal)),
  };
}

export function vatReturn(totals: AccountTotals[]) {
  const output = totals.find(t => t.account.code === '2100');
  const input = totals.find(t => t.account.code === '2200');
  const outputVat = round2(output?.balance ?? 0);
  const inputVat = round2(input?.balance ?? 0);
  return { outputVat, inputVat, netPayable: round2(outputVat - inputVat) };
}