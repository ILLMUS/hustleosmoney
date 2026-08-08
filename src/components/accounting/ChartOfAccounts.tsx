import { useMemo, useState } from 'react';
import { Account, AccountType, ACCOUNT_TYPE_LABEL, AccountTotals, money } from '@/lib/accounting';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface Props {
  totals: AccountTotals[];
  onCreate: (account: { code: string; name: string; type: AccountType; vat_rate: number }) => Promise<void>;
}

const ORDER: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'];

export function ChartOfAccounts({ totals, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('expense');
  const [vatRate, setVatRate] = useState('0');
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    return ORDER.map(t => ({
      type: t,
      rows: totals.filter(r => r.account.type === t && !r.account.is_archived),
    })).filter(g => g.rows.length > 0);
  }, [totals]);

  const submit = async () => {
    if (!code.trim() || !name.trim()) return;
    setSaving(true);
    await onCreate({ code: code.trim(), name: name.trim(), type, vat_rate: Number(vatRate) || 0 });
    setSaving(false);
    setCode(''); setName(''); setVatRate('0'); setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold text-base">Chart of accounts</h3>
          <p className="text-xs text-muted-foreground">Every transaction posts to one of these accounts.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(v => !v)}>
          <Plus className="h-3.5 w-3.5" /> New account
        </Button>
      </div>

      {open && (
        <Card className="p-4 grid gap-3 sm:grid-cols-5 items-end">
          <div>
            <Label className="text-xs">Code</Label>
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="6100" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Fuel & travel" />
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={v => setType(v as AccountType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER.map(t => <SelectItem key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">VAT %</Label>
              <Input type="number" value={vatRate} onChange={e => setVatRate(e.target.value)} />
            </div>
            <Button size="sm" onClick={submit} disabled={saving} className="self-end">Add</Button>
          </div>
        </Card>
      )}

      {grouped.map(group => (
        <Card key={group.type} className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="font-heading font-semibold text-sm">{ACCOUNT_TYPE_LABEL[group.type]}</h4>
            <Badge variant="outline" className="text-[10px]">{group.rows.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="py-1.5 pr-2 font-medium w-16">Code</th>
                  <th className="py-1.5 pr-2 font-medium">Account</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Debit</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Credit</th>
                  <th className="py-1.5 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map(r => (
                  <tr key={r.account.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 text-muted-foreground">{r.account.code}</td>
                    <td className="py-1.5 pr-2">
                      {r.account.name}
                      {r.account.vat_rate > 0 && (
                        <Badge variant="outline" className="ml-2 text-[10px]">VAT {r.account.vat_rate}%</Badge>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-muted-foreground">{money(r.debit)}</td>
                    <td className="py-1.5 pr-2 text-right text-muted-foreground">{money(r.credit)}</td>
                    <td className="py-1.5 text-right font-medium">{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}