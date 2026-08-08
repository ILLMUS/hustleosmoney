import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Account, DraftLine, JournalEntry, JournalLine, accountByCode, money, round2 } from '@/lib/accounting';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload } from 'lucide-react';

export interface BankRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  matchEntryId: string | null;
  accountId: string;
  imported: boolean;
}

interface Props {
  accounts: Account[];
  entries: JournalEntry[];
  lines: JournalLine[];
  onCreate: (
    header: { entry_date: string; memo: string; reference: string; contact_name: string },
    draft: DraftLine[],
  ) => Promise<void>;
  onToggleReconciled: (entryId: string, reconciled: boolean) => Promise<void>;
}

/** Minimal CSV parser handling quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

function normaliseDate(raw: string): string | null {
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

const toNumber = (raw: string) => {
  const cleaned = raw.replace(/[^0-9.,\-()]/g, '').replace(/[(](.*)[)]/, '-$1').replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const findIndex = (header: string[], names: string[]) =>
  header.findIndex(h => names.some(n => h.trim().toLowerCase().includes(n)));

export function BankImport({ accounts, entries, lines, onCreate, onToggleReconciled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BankRow[]>([]);
  const [fileName, setFileName] = useState('');
  const bank = useMemo(() => accountByCode(accounts, '1000'), [accounts]);

  /** Bank movement per journal entry, used for auto-matching. */
  const entryAmounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!bank) return map;
    lines.filter(l => l.account_id === bank.id).forEach(l => {
      map.set(l.entry_id, round2((map.get(l.entry_id) ?? 0) + Number(l.debit) - Number(l.credit)));
    });
    return map;
  }, [bank, lines]);

  const matchFor = (date: string, amount: number) => {
    const target = round2(amount);
    const candidates = entries.filter(e => {
      const amt = entryAmounts.get(e.id);
      if (amt === undefined || round2(amt) !== target) return false;
      const diff = Math.abs(new Date(e.entry_date).getTime() - new Date(date).getTime()) / 86400000;
      return diff <= 5;
    });
    return candidates[0]?.id ?? null;
  };

  const defaultAccountId = (amount: number) => {
    const fallback = amount >= 0 ? accountByCode(accounts, '4000') : accountByCode(accounts, '6000');
    return fallback?.id ?? '';
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const table = parseCsv(text);
    if (table.length < 2) { toast.error('That file has no rows we can read'); return; }
    const header = table[0];
    const dateIdx = findIndex(header, ['date']);
    const descIdx = findIndex(header, ['description', 'detail', 'narrative', 'reference', 'memo']);
    const amountIdx = findIndex(header, ['amount', 'value']);
    const debitIdx = findIndex(header, ['debit', 'money out', 'withdrawal']);
    const creditIdx = findIndex(header, ['credit', 'money in', 'deposit']);
    if (dateIdx < 0 || (amountIdx < 0 && debitIdx < 0 && creditIdx < 0)) {
      toast.error('Need a date column and an amount (or debit/credit) column');
      return;
    }

    const parsed: BankRow[] = [];
    table.slice(1).forEach((r, i) => {
      const date = normaliseDate(r[dateIdx] ?? '');
      if (!date) return;
      const amount = amountIdx >= 0
        ? round2(toNumber(r[amountIdx] ?? ''))
        : round2(Math.abs(toNumber(r[creditIdx] ?? '')) - Math.abs(toNumber(r[debitIdx] ?? '')));
      if (!amount) return;
      const description = (descIdx >= 0 ? r[descIdx] : '')?.trim() || 'Bank transaction';
      parsed.push({
        id: `${i}-${date}-${amount}`,
        date,
        description,
        amount,
        matchEntryId: matchFor(date, amount),
        accountId: defaultAccountId(amount),
        imported: false,
      });
    });

    if (parsed.length === 0) { toast.error('No usable transactions found'); return; }
    setRows(parsed);
    setFileName(file.name);
    const matched = parsed.filter(r => r.matchEntryId).length;
    toast.success(`${parsed.length} transactions read — ${matched} auto-matched`);
  };

  const confirmMatch = async (row: BankRow) => {
    if (!row.matchEntryId) return;
    await onToggleReconciled(row.matchEntryId, true);
    setRows(prev => prev.map(r => (r.id === row.id ? { ...r, imported: true } : r)));
  };

  const createEntry = async (row: BankRow) => {
    if (!bank || !row.accountId) { toast.error('Pick a category first'); return; }
    const amt = Math.abs(row.amount);
    const draft: DraftLine[] = row.amount > 0
      ? [
          { account_id: bank.id, description: row.description, debit: amt, credit: 0 },
          { account_id: row.accountId, description: row.description, debit: 0, credit: amt },
        ]
      : [
          { account_id: row.accountId, description: row.description, debit: amt, credit: 0 },
          { account_id: bank.id, description: row.description, debit: 0, credit: amt },
        ];
    await onCreate(
      { entry_date: row.date, memo: row.description, reference: fileName, contact_name: '' },
      draft,
    );
    setRows(prev => prev.map(r => (r.id === row.id ? { ...r, imported: true } : r)));
  };

  const importAllMatched = async () => {
    for (const row of rows.filter(r => r.matchEntryId && !r.imported)) {
      await confirmMatch(row);
    }
  };

  const pending = rows.filter(r => !r.imported);
  const categoryAccounts = accounts.filter(a => a.code !== '1000' && !a.is_archived);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Import a bank statement</p>
          <p className="text-xs text-muted-foreground">
            CSV with a date column, a description, and either an amount or debit/credit columns. Money in is positive.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Choose CSV
          </Button>
          {rows.some(r => r.matchEntryId && !r.imported) && (
            <Button size="sm" variant="outline" onClick={importAllMatched}>Clear all matched</Button>
          )}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2">
            {fileName} · {pending.length} to review · {rows.length - pending.length} done
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="py-1.5 pr-2 font-medium whitespace-nowrap">Date</th>
                  <th className="py-1.5 pr-2 font-medium">Description</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Amount</th>
                  <th className="py-1.5 pr-2 font-medium">Category / match</th>
                  <th className="py-1.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className={`border-b last:border-0 ${row.imported ? 'opacity-50' : ''}`}>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{format(new Date(row.date), 'dd MMM yyyy')}</td>
                    <td className="py-1.5 pr-2 truncate max-w-[200px]">{row.description}</td>
                    <td className={`py-1.5 pr-2 text-right font-medium ${row.amount < 0 ? 'text-destructive' : 'text-success'}`}>
                      {money(row.amount)}
                    </td>
                    <td className="py-1.5 pr-2">
                      {row.matchEntryId ? (
                        <Badge className="text-[10px]">Matches existing entry</Badge>
                      ) : (
                        <Select
                          value={row.accountId}
                          onValueChange={v => setRows(prev => prev.map(r => (r.id === row.id ? { ...r, accountId: v } : r)))}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-[190px]"><SelectValue placeholder="Pick account" /></SelectTrigger>
                          <SelectContent>
                            {categoryAccounts.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      {row.imported ? (
                        <span className="text-[11px] text-muted-foreground">Done</span>
                      ) : row.matchEntryId ? (
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => confirmMatch(row)}>
                          Mark cleared
                        </Button>
                      ) : (
                        <Button size="sm" className="h-7 text-[11px]" onClick={() => createEntry(row)}>
                          Create entry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}