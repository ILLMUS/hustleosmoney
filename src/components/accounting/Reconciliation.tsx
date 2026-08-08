import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Account, JournalEntry, JournalLine, money, round2 } from '@/lib/accounting';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Props {
  accounts: Account[];
  entries: JournalEntry[];
  lines: JournalLine[];
  onToggle: (entryId: string, reconciled: boolean) => Promise<void>;
}

export function Reconciliation({ accounts, entries, lines, onToggle }: Props) {
  const bank = accounts.find(a => a.code === '1000');
  const [filter, setFilter] = useState<'all' | 'unreconciled' | 'reconciled'>('unreconciled');

  const rows = useMemo(() => {
    if (!bank) return [];
    const byEntry = new Map<string, { debit: number; credit: number }>();
    lines.filter(l => l.account_id === bank.id).forEach(l => {
      const cur = byEntry.get(l.entry_id) ?? { debit: 0, credit: 0 };
      cur.debit += Number(l.debit); cur.credit += Number(l.credit);
      byEntry.set(l.entry_id, cur);
    });
    return entries
      .filter(e => byEntry.has(e.id))
      .map(e => {
        const v = byEntry.get(e.id)!;
        return { entry: e, amount: round2(v.debit - v.credit) };
      })
      .sort((a, b) => a.entry.entry_date.localeCompare(b.entry.entry_date));
  }, [bank, entries, lines]);

  const visible = rows.filter(r =>
    filter === 'all' ? true : filter === 'reconciled' ? r.entry.is_reconciled : !r.entry.is_reconciled,
  );

  const clearedBalance = round2(rows.filter(r => r.entry.is_reconciled).reduce((s, r) => s + r.amount, 0));
  const bookBalance = round2(rows.reduce((s, r) => s + r.amount, 0));

  let running = 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Book balance</p>
          <p className="text-xl font-heading font-bold">{money(bookBalance)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Cleared balance</p>
          <p className="text-xl font-heading font-bold">{money(clearedBalance)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Un-cleared</p>
          <p className="text-xl font-heading font-bold">{money(round2(bookBalance - clearedBalance))}</p>
        </Card>
      </div>

      <div className="flex gap-2">
        {(['unreconciled', 'reconciled', 'all'] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="capitalize" onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>

      <Card className="p-4">
        {!bank ? (
          <p className="text-xs text-muted-foreground">No bank account found in the chart of accounts.</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing to show here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="py-1.5 pr-2 font-medium">Date</th>
                  <th className="py-1.5 pr-2 font-medium">Description</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Money in</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Money out</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Running</th>
                  <th className="py-1.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => {
                  running = round2(running + r.amount);
                  return (
                    <tr key={r.entry.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{format(new Date(r.entry.entry_date), 'dd MMM yyyy')}</td>
                      <td className="py-1.5 pr-2 truncate max-w-[220px]">{r.entry.memo || r.entry.reference || '—'}</td>
                      <td className="py-1.5 pr-2 text-right text-success">{r.amount > 0 ? money(r.amount) : '—'}</td>
                      <td className="py-1.5 pr-2 text-right text-destructive">{r.amount < 0 ? money(Math.abs(r.amount)) : '—'}</td>
                      <td className="py-1.5 pr-2 text-right text-muted-foreground">{money(running)}</td>
                      <td className="py-1.5 text-right">
                        {r.entry.is_reconciled ? (
                          <button onClick={() => onToggle(r.entry.id, false)}>
                            <Badge className="text-[10px] cursor-pointer">Cleared</Badge>
                          </button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => onToggle(r.entry.id, true)}>
                            Mark cleared
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}