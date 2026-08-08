import { useMemo, useState } from 'react';
import {
  Account, AccountTotals, JournalEntry, JournalLine, LedgerFilters, VOUCHER_TYPES,
  accountTotals, balanceSheet, money, profitAndLoss, uniqueContacts, uniqueCostCenters, vatReturn,
} from '@/lib/accounting';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  accounts: Account[];
  entries: JournalEntry[];
  lines: JournalLine[];
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
  vatRegistered: boolean;
}

const ALL = '__all__';

function Rows({ rows }: { rows: AccountTotals[] }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Nothing recorded.</p>;
  return (
    <table className="w-full text-xs sm:text-sm">
      <tbody>
        {rows.map(r => (
          <tr key={r.account.id} className="border-b last:border-0">
            <td className="py-1.5 pr-2 text-muted-foreground w-14">{r.account.code}</td>
            <td className="py-1.5 pr-2">{r.account.name}</td>
            <td className="py-1.5 text-right font-medium">{money(r.balance)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Reports({ accounts, entries, lines, from, to, onRangeChange, vatRegistered }: Props) {
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const [voucherType, setVoucherType] = useState<string>(ALL);
  const [contact, setContact] = useState<string>(ALL);
  const [costCenter, setCostCenter] = useState<string>(ALL);

  const contacts = useMemo(() => uniqueContacts(entries), [entries]);
  const costCenters = useMemo(() => uniqueCostCenters(entries), [entries]);

  const baseFilters: LedgerFilters = useMemo(() => ({
    voucherTypes: voucherType === ALL ? undefined : [voucherType],
    contact: contact === ALL ? undefined : contact,
    costCenter: costCenter === ALL ? undefined : costCenter,
  }), [voucherType, contact, costCenter]);

  const totalsInRange = useMemo(
    () => accountTotals(accounts, lines, entries, { ...baseFilters, from, to }),
    [accounts, lines, entries, baseFilters, from, to],
  );
  const totalsAllTime = useMemo(
    () => accountTotals(accounts, lines, entries, baseFilters),
    [accounts, lines, entries, baseFilters],
  );

  const pl = useMemo(() => profitAndLoss(totalsInRange), [totalsInRange]);
  const plAll = useMemo(() => profitAndLoss(totalsAllTime), [totalsAllTime]);
  const bs = useMemo(() => balanceSheet(totalsAllTime, plAll.netProfit), [totalsAllTime, plAll.netProfit]);
  const vat = useMemo(() => vatReturn(totalsInRange), [totalsInRange]);
  const trial = totalsAllTime.filter(t => t.debit || t.credit);
  const trialDebit = trial.reduce((s, t) => s + t.debit, 0);
  const trialCredit = trial.reduce((s, t) => s + t.credit, 0);
  const filtered = voucherType !== ALL || contact !== ALL || costCenter !== ALL;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={localFrom} onChange={e => { setLocalFrom(e.target.value); onRangeChange(e.target.value, localTo); }} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={localTo} onChange={e => { setLocalTo(e.target.value); onRangeChange(localFrom, e.target.value); }} />
          </div>
          <div>
            <Label className="text-xs">Voucher type</Label>
            <Select value={voucherType} onValueChange={setVoucherType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All vouchers</SelectItem>
                {VOUCHER_TYPES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Client / contact</Label>
            <Select value={contact} onValueChange={setContact}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All contacts</SelectItem>
                {contacts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cost center</Label>
            <Select value={costCenter} onValueChange={setCostCenter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All cost centers</SelectItem>
                {costCenters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Profit &amp; loss and the VAT return use this period. Balance sheet and trial balance are to date, using the same filters.
          </p>
          {filtered && (
            <Button size="sm" variant="ghost" onClick={() => { setVoucherType(ALL); setContact(ALL); setCostCenter(ALL); }}>
              Clear filters
            </Button>
          )}
        </div>
        {filtered && (
          <p className="text-[11px] text-muted-foreground">
            Filtered view — a filtered balance sheet or trial balance will not normally balance.
          </p>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-heading font-semibold text-base">Profit &amp; loss</h3>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Income</p>
          <Rows rows={pl.income} />
          <p className="text-right text-sm font-semibold mt-1">Total income {money(pl.incomeTotal)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Expenses</p>
          <Rows rows={pl.expenses} />
          <p className="text-right text-sm font-semibold mt-1">Total expenses {money(pl.expenseTotal)}</p>
        </div>
        <div className="border-t pt-2 flex items-center justify-between">
          <span className="font-heading font-semibold">Net profit</span>
          <span className={`font-heading font-bold ${pl.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{money(pl.netProfit)}</span>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-heading font-semibold text-base">Balance sheet</h3>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Assets</p>
          <Rows rows={bs.assets} />
          <p className="text-right text-sm font-semibold mt-1">Total assets {money(bs.assetTotal)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Liabilities</p>
          <Rows rows={bs.liabilities} />
          <p className="text-right text-sm font-semibold mt-1">Total liabilities {money(bs.liabilityTotal)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Equity (incl. retained profit)</p>
          <Rows rows={bs.equity} />
          <p className="text-right text-sm font-semibold mt-1">Total equity {money(bs.equityTotal)}</p>
        </div>
        <div className="border-t pt-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Assets − (Liabilities + Equity)</span>
          <Badge variant={bs.difference === 0 ? 'outline' : 'destructive'} className="text-[10px]">{money(bs.difference)}</Badge>
        </div>
      </Card>

      {vatRegistered && (
        <Card className="p-4 space-y-2">
          <h3 className="font-heading font-semibold text-base">VAT return</h3>
          <div className="flex justify-between text-sm"><span>VAT on sales (output)</span><span className="font-medium">{money(vat.outputVat)}</span></div>
          <div className="flex justify-between text-sm"><span>VAT on purchases (input)</span><span className="font-medium">{money(vat.inputVat)}</span></div>
          <div className="border-t pt-2 flex justify-between font-heading font-bold">
            <span>{vat.netPayable >= 0 ? 'VAT payable' : 'VAT refundable'}</span>
            <span>{money(Math.abs(vat.netPayable))}</span>
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <h3 className="font-heading font-semibold text-base">Trial balance</h3>
        <table className="w-full text-xs sm:text-sm">
          <thead className="text-muted-foreground text-left">
            <tr className="border-b">
              <th className="py-1.5 pr-2 font-medium">Account</th>
              <th className="py-1.5 pr-2 font-medium text-right">Debit</th>
              <th className="py-1.5 font-medium text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {trial.map(t => (
              <tr key={t.account.id} className="border-b last:border-0">
                <td className="py-1.5 pr-2">{t.account.code} · {t.account.name}</td>
                <td className="py-1.5 pr-2 text-right">{money(t.debit)}</td>
                <td className="py-1.5 text-right">{money(t.credit)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5 pr-2">Totals</td>
              <td className="py-1.5 pr-2 text-right">{money(trialDebit)}</td>
              <td className="py-1.5 text-right">{money(trialCredit)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}