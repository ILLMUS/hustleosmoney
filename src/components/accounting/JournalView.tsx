import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Account, JournalEntry, JournalLine, DraftLine, money, linesBalanced } from '@/lib/accounting';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

interface Props {
  accounts: Account[];
  entries: JournalEntry[];
  lines: JournalLine[];
  vatRate: number;
  vatRegistered: boolean;
  onCreate: (header: { entry_date: string; memo: string; reference: string; contact_name: string }, lines: DraftLine[]) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
}

interface Row { account_id: string; description: string; debit: string; credit: string }

const emptyRow = (): Row => ({ account_id: '', description: '', debit: '', credit: '' });

export function JournalView({ accounts, entries, lines, vatRate, vatRegistered, onCreate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [reference, setReference] = useState('');
  const [contact, setContact] = useState('');
  const [includeVat, setIncludeVat] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);

  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const linesByEntry = useMemo(() => {
    const m = new Map<string, JournalLine[]>();
    lines.forEach(l => m.set(l.entry_id, [...(m.get(l.entry_id) ?? []), l]));
    return m;
  }, [lines]);

  const numeric = rows.map(r => ({ debit: Number(r.debit) || 0, credit: Number(r.credit) || 0 }));
  const totals = linesBalanced(numeric);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const reset = () => {
    setRows([emptyRow(), emptyRow()]);
    setMemo(''); setReference(''); setContact(''); setIncludeVat(false);
  };

  const submit = async () => {
    if (!totals.balanced) return;
    setSaving(true);
    const draft: DraftLine[] = rows
      .filter(r => r.account_id && (Number(r.debit) || Number(r.credit)))
      .map(r => {
        const gross = Number(r.debit) || Number(r.credit) || 0;
        const vat = includeVat && vatRegistered ? Math.round((gross - gross / (1 + vatRate / 100)) * 100) / 100 : 0;
        return {
          account_id: r.account_id,
          description: r.description,
          debit: Number(r.debit) || 0,
          credit: Number(r.credit) || 0,
          vat_amount: vat,
        };
      });
    await onCreate({ entry_date: date, memo, reference, contact_name: contact }, draft);
    setSaving(false);
    reset();
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold text-base">Journal</h3>
          <p className="text-xs text-muted-foreground">Every entry must balance: total debits = total credits.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(v => !v)}>
          <Plus className="h-3.5 w-3.5" /> New entry
        </Button>
      </div>

      {open && (
        <Card className="p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="INV-0012" />
            </div>
            <div>
              <Label className="text-xs">Contact</Label>
              <Input value={contact} onChange={e => setContact(e.target.value)} placeholder="Supplier or client" />
            </div>
            <div>
              <Label className="text-xs">Memo</Label>
              <Input value={memo} onChange={e => setMemo(e.target.value)} placeholder="What is this for?" />
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-12 items-end">
                <div className="sm:col-span-4">
                  <Label className="text-xs sm:sr-only">Account</Label>
                  <Select value={r.account_id} onValueChange={v => setRow(i, { account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-4">
                  <Input value={r.description} onChange={e => setRow(i, { description: e.target.value })} placeholder="Description" />
                </div>
                <div className="sm:col-span-2">
                  <Input type="number" value={r.debit} onChange={e => setRow(i, { debit: e.target.value, credit: '' })} placeholder="Debit" />
                </div>
                <div className="sm:col-span-2 flex gap-1">
                  <Input type="number" value={r.credit} onChange={e => setRow(i, { credit: e.target.value, debit: '' })} placeholder="Credit" />
                  <Button variant="ghost" size="icon" onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setRows(prev => [...prev, emptyRow()])}>
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Debits {money(totals.debit)}</span>
              <span className="text-muted-foreground">Credits {money(totals.credit)}</span>
              <Badge variant={totals.balanced ? 'outline' : 'destructive'} className="text-[10px]">
                {totals.balanced ? 'Balanced' : 'Out of balance'}
              </Badge>
              {vatRegistered && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={includeVat} onChange={e => setIncludeVat(e.target.checked)} />
                  Amounts include {vatRate}% VAT
                </label>
              )}
            </div>
            <Button size="sm" onClick={submit} disabled={!totals.balanced || saving}>Post entry</Button>
          </div>
        </Card>
      )}

      {entries.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No journal entries yet. Post receipts or add a manual entry.</p>
        </Card>
      ) : (
        entries.map(entry => {
          const own = linesByEntry.get(entry.id) ?? [];
          const total = own.reduce((s, l) => s + Number(l.debit), 0);
          const isOpen = expanded === entry.id;
          return (
            <Card key={entry.id} className="p-3 sm:p-4">
              <button className="w-full flex items-center gap-3 text-left" onClick={() => setExpanded(isOpen ? null : entry.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.voucher_number && <Badge className="text-[10px]">{entry.voucher_number}</Badge>}
                    <span className="font-heading font-semibold text-sm truncate">{entry.memo || 'Journal entry'}</span>
                    {entry.reference && <Badge variant="outline" className="text-[10px]">{entry.reference}</Badge>}
                    <Badge variant="outline" className="text-[10px] capitalize">{entry.source_type}</Badge>
                    {entry.is_reconciled && <Badge className="text-[10px]">Reconciled</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(entry.entry_date), 'dd MMM yyyy')}
                    {entry.contact_name ? ` · ${entry.contact_name}` : ''} · {own.length} lines
                  </p>
                </div>
                <span className="font-heading font-bold text-sm">{money(total)}</span>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="text-muted-foreground text-left">
                      <tr className="border-b">
                        <th className="py-1.5 pr-2 font-medium">Account</th>
                        <th className="py-1.5 pr-2 font-medium">Description</th>
                        <th className="py-1.5 pr-2 font-medium text-right">Debit</th>
                        <th className="py-1.5 font-medium text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {own.map(l => {
                        const acc = accountById.get(l.account_id);
                        return (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-2">{acc ? `${acc.code} · ${acc.name}` : 'Unknown account'}</td>
                            <td className="py-1.5 pr-2 text-muted-foreground truncate max-w-[220px]">{l.description || '—'}</td>
                            <td className="py-1.5 pr-2 text-right">{Number(l.debit) ? money(l.debit) : '—'}</td>
                            <td className="py-1.5 text-right">{Number(l.credit) ? money(l.credit) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={() => onDelete(entry.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete entry
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}