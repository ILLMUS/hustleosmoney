import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  CostItem,
  CostCategory,
  COST_CATEGORIES,
  calculateCostTotal,
  generateId,
  QuoteDocument,
} from '@/types/document';
import { useDocuments } from '@/context/DocumentContext';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n || 0);

export default function CostBreakdownEditor({ doc }: { doc: QuoteDocument }) {
  const { updateDocument } = useDocuments();
  const [costItems, setCostItems] = useState<CostItem[]>(doc.costItems ?? []);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setCostItems(doc.costItems ?? []);
    setDirty(false);
  }, [doc.id]);

  const update = (next: CostItem[]) => {
    setCostItems(next);
    setDirty(true);
  };

  const addItem = () =>
    update([...costItems, { id: generateId(), category: 'labour', description: '', amount: 0 }]);
  const removeItem = (id: string) => update(costItems.filter(c => c.id !== id));
  const patch = (id: string, field: keyof CostItem, value: any) =>
    update(costItems.map(c => (c.id === id ? { ...c, [field]: value } : c)));

  const total = calculateCostTotal(costItems);

  const save = async () => {
    await updateDocument({ ...doc, costItems });
    setDirty(false);
    toast.success('Cost breakdown saved — Money Tracker updated');
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-heading font-semibold text-lg">Cost to do the job</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Internal only — never printed on the document. Record only the money it costs to render the
          service (Labour), bought-in or outsourced work (Services), the sales margin you keep (Margin),
          and anything else that doesn't fit (Other, with your own term). This total is what flows into
          the Money Tracker; the rest of the document total stays as company revenue.
        </p>
      </div>

      {costItems.length > 0 && (
        <div className="space-y-3">
          <div className="hidden sm:grid grid-cols-[150px_1fr_120px_40px] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            <span>Category</span><span>Description</span><span>Amount</span><span></span>
          </div>
          {costItems.map(c => (
            <div key={c.id} className="grid sm:grid-cols-[150px_1fr_120px_40px] gap-2 items-center">
              <div className="space-y-2">
                <Select value={c.category} onValueChange={v => patch(c.id, 'category', v as CostCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COST_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {c.category === 'other' && (
                  <Input
                    value={c.customLabel ?? ''}
                    onChange={e => patch(c.id, 'customLabel', e.target.value)}
                    placeholder="Custom term"
                    className="h-8 text-xs"
                  />
                )}
              </div>
              <Input
                value={c.description}
                onChange={e => patch(c.id, 'description', e.target.value)}
                placeholder="What this cost covers"
              />
              <Input
                type="number"
                min={0}
                step={0.01}
                value={c.amount}
                onChange={e => patch(c.id, 'amount', parseFloat(e.target.value) || 0)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeItem(c.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={addItem} className="gap-2">
          <Plus className="h-4 w-4" /> Add cost line
        </Button>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground mr-2">Total job cost</span>
            <span className="font-heading font-bold">{formatCurrency(total)}</span>
          </div>
          <Button onClick={save} disabled={!dirty} size="sm" className="gap-2">
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
