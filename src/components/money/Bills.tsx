import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { money } from '@/lib/accounting';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

export interface Bill {
  id: string;
  supplier: string;
  description: string;
  category: string;
  amount: number;
  vat_amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  paid_at: string | null;
  is_recurring: boolean;
  notes: string;
}

const CATEGORIES = [
  { value: 'materials', label: 'Materials' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'labour', label: 'Labour' },
  { value: 'fuel', label: 'Fuel & transport' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities & airtime' },
  { value: 'tax', label: 'Tax' },
  { value: 'loan', label: 'Loan repayment' },
  { value: 'other', label: 'Other' },
];

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  supplier: '',
  description: '',
  category: 'materials',
  amount: '',
  vat_amount: '',
  issue_date: today(),
  due_date: today(),
  is_recurring: false,
  notes: '',
});

export function Bills() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [filter, setFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true });
    setBills((data ?? []) as unknown as Bill[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const stats = useMemo(() => {
    const now = new Date();
    const unpaid = bills.filter(b => b.status !== 'paid');
    const outstanding = unpaid.reduce((s, b) => s + Number(b.amount), 0);
    const overdue = unpaid
      .filter(b => differenceInCalendarDays(now, new Date(b.due_date)) > 0)
      .reduce((s, b) => s + Number(b.amount), 0);
    const next7 = unpaid
      .filter(b => {
        const d = differenceInCalendarDays(new Date(b.due_date), now);
        return d >= 0 && d <= 7;
      })
      .reduce((s, b) => s + Number(b.amount), 0);
    return { outstanding, overdue, next7, count: unpaid.length };
  }, [bills]);

  const visible = bills.filter(b =>
    filter === 'all' ? true : filter === 'paid' ? b.status === 'paid' : b.status !== 'paid',
  );

  const save = async () => {
    if (!user) return;
    if (!form.supplier.trim() || !Number(form.amount)) {
      toast.error('Supplier and amount are required');
      return;
    }
    const { error } = await supabase.from('bills').insert({
      user_id: user.id,
      supplier: form.supplier.trim(),
      description: form.description.trim(),
      category: form.category,
      amount: Number(form.amount),
      vat_amount: Number(form.vat_amount) || 0,
      issue_date: form.issue_date,
      due_date: form.due_date,
      is_recurring: form.is_recurring,
      notes: form.notes.trim(),
    });
    if (error) { toast.error('Could not save bill'); return; }
    setForm(emptyForm());
    setShowForm(false);
    await load();
    toast.success('Bill added');
  };

  const togglePaid = async (b: Bill) => {
    const paid = b.status !== 'paid';
    const { error } = await supabase
      .from('bills')
      .update({ status: paid ? 'paid' : 'unpaid', paid_at: paid ? today() : null })
      .eq('id', b.id);
    if (error) { toast.error('Could not update bill'); return; }
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) { toast.error('Could not delete bill'); return; }
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">You owe</p>
          <p className="text-xl font-heading font-bold">{money(stats.outstanding)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="text-xl font-heading font-bold text-destructive">{money(stats.overdue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Due next 7 days</p>
          <p className="text-xl font-heading font-bold">{money(stats.next7)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Open bills</p>
          <p className="text-xl font-heading font-bold">{stats.count}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {(['unpaid', 'paid', 'all'] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="capitalize" onClick={() => setFilter(f)}>
              {f}
            </Button>
          ))}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3.5 w-3.5" /> Add bill
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs">Supplier</Label>
            <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="e.g. Build It" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is it for?" />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Amount</Label>
            <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">VAT included</Label>
            <Input type="number" value={form.vat_amount} onChange={e => setForm(f => ({ ...f, vat_amount: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Bill date</Label>
            <Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Due date</Label>
            <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={save}>Save bill</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading bills…</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">No bills here yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="py-1.5 pr-2 font-medium">Supplier</th>
                  <th className="py-1.5 pr-2 font-medium">Description</th>
                  <th className="py-1.5 pr-2 font-medium whitespace-nowrap">Due</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Amount</th>
                  <th className="py-1.5 pr-2 font-medium">Status</th>
                  <th className="py-1.5 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(b => {
                  const late = b.status !== 'paid' && differenceInCalendarDays(new Date(), new Date(b.due_date)) > 0;
                  return (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 truncate max-w-[140px]">{b.supplier}</td>
                      <td className="py-1.5 pr-2 truncate max-w-[180px] text-muted-foreground">
                        {b.description || CATEGORIES.find(c => c.value === b.category)?.label}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{format(new Date(b.due_date), 'dd MMM yyyy')}</td>
                      <td className="py-1.5 pr-2 text-right font-medium">{money(Number(b.amount))}</td>
                      <td className="py-1.5 pr-2">
                        <button onClick={() => togglePaid(b)}>
                          <Badge
                            variant={b.status === 'paid' ? 'default' : late ? 'destructive' : 'secondary'}
                            className="text-[10px] cursor-pointer capitalize"
                          >
                            {b.status === 'paid' ? 'Paid' : late ? 'Overdue' : 'Unpaid'}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-1.5 text-right">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(b.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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