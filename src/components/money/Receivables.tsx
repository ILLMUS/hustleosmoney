import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useDocuments } from '@/context/DocumentContext';
import { QuoteDocument, calculateGrandTotal } from '@/types/document';
import { money } from '@/lib/accounting';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MessageCircle, Smartphone, Zap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { fillTemplate } from '@/lib/messageTemplates';

type Bucket = 'current' | '0-30' | '31-60' | '60+';

const BUCKET_LABEL: Record<Bucket, string> = {
  current: 'Not yet due',
  '0-30': '0–30 days late',
  '31-60': '31–60 days late',
  '60+': '60+ days late',
};

const docTotal = (d: QuoteDocument) => calculateGrandTotal(d.items ?? [], d.taxRate || 0);

const dueDateOf = (d: QuoteDocument) => d.dueDate || d.issueDate || d.createdAt.slice(0, 10);

function bucketOf(daysLate: number): Bucket {
  if (daysLate <= 0) return 'current';
  if (daysLate <= 30) return '0-30';
  if (daysLate <= 60) return '31-60';
  return '60+';
}

export function Receivables() {
  const { documents } = useDocuments();
  const navigate = useNavigate();
  const [active, setActive] = useState<Bucket | 'all'>('all');

  const rows = useMemo(() => {
    const today = new Date();
    return documents
      .filter(d => d.type === 'invoice')
      .map(d => {
        const due = dueDateOf(d);
        const daysLate = differenceInCalendarDays(today, new Date(due));
        return { doc: d, due, daysLate, amount: docTotal(d), bucket: bucketOf(daysLate) };
      })
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [documents]);

  const totals = useMemo(() => {
    const t: Record<Bucket, number> = { current: 0, '0-30': 0, '31-60': 0, '60+': 0 };
    rows.forEach(r => { t[r.bucket] += r.amount; });
    return t;
  }, [rows]);

  const owedTotal = rows.reduce((s, r) => s + r.amount, 0);
  const overdueTotal = totals['0-30'] + totals['31-60'] + totals['60+'];
  const visible = active === 'all' ? rows : rows.filter(r => r.bucket === active);

  const reminderText = (r: typeof rows[number]) => {
    const key = r.daysLate > 60 ? 'invoice_very_late' : r.daysLate > 0 ? 'invoice_late' : 'invoice_due';
    return fillTemplate(key, {
      name: r.doc.clientInfo?.name,
      ref: r.doc.invoiceNumber ?? r.doc.quoteNumber,
      amount: money(r.amount),
      due: format(new Date(r.due), 'dd MMM yyyy'),
      days: r.daysLate,
    });
  };

  const phoneOf = (r: typeof rows[number]) => (r.doc.clientInfo?.phone || '').replace(/\D/g, '');

  const chaseWhatsApp = (r: typeof rows[number]) => {
    const text = encodeURIComponent(reminderText(r));
    const phone = phoneOf(r);
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank');
  };

  const chaseSMS = (r: typeof rows[number]) => {
    const phone = phoneOf(r);
    if (!phone) {
      toast({ title: 'No phone number', description: `${r.doc.clientInfo?.name || 'This client'} has no phone number saved.`, variant: 'destructive' });
      return;
    }
    window.open(`sms:${phone}?&body=${encodeURIComponent(reminderText(r))}`, '_self');
  };

  const chaseAllOverdue = () => {
    const overdue = visible.filter(r => r.daysLate > 0);
    if (overdue.length === 0) {
      toast({ title: 'Nothing overdue', description: 'No late invoices in this view.' });
      return;
    }
    overdue.forEach((r, i) => setTimeout(() => chaseWhatsApp(r), i * 400));
    toast({ title: `Chasing ${overdue.length} invoice${overdue.length > 1 ? 's' : ''}`, description: 'A WhatsApp tab opens per client. Allow pop-ups if blocked.' });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total owed to you</p>
          <p className="text-xl font-heading font-bold">{money(owedTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-destructive" /> Overdue
          </p>
          <p className="text-xl font-heading font-bold text-destructive">{money(overdueTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Invoices outstanding</p>
          <p className="text-xl font-heading font-bold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Worst age</p>
          <p className="text-xl font-heading font-bold">
            {rows.length ? `${Math.max(0, rows[0].daysLate)} days` : '—'}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={active === 'all' ? 'default' : 'outline'} onClick={() => setActive('all')}>
          All ({money(owedTotal)})
        </Button>
        {(Object.keys(BUCKET_LABEL) as Bucket[]).map(b => (
          <Button key={b} size="sm" variant={active === b ? 'default' : 'outline'} onClick={() => setActive(b)}>
            {BUCKET_LABEL[b]} ({money(totals[b])})
          </Button>
        ))}
        <Button size="sm" variant="destructive" className="gap-1" onClick={chaseAllOverdue}>
          <Zap className="h-3 w-3" /> Chase all overdue
        </Button>
      </div>

      <Card className="p-4">
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing outstanding here. Invoices appear once a quote is converted, and drop off when you issue the receipt.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="py-1.5 pr-2 font-medium">Invoice</th>
                  <th className="py-1.5 pr-2 font-medium">Client</th>
                  <th className="py-1.5 pr-2 font-medium whitespace-nowrap">Due</th>
                  <th className="py-1.5 pr-2 font-medium">Age</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Amount</th>
                  <th className="py-1.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.doc.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      <button className="underline underline-offset-2" onClick={() => navigate(`/preview/${r.doc.id}`)}>
                        {r.doc.invoiceNumber ?? r.doc.quoteNumber}
                      </button>
                    </td>
                    <td className="py-1.5 pr-2 truncate max-w-[160px]">{r.doc.clientInfo?.name || '—'}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{format(new Date(r.due), 'dd MMM yyyy')}</td>
                    <td className="py-1.5 pr-2">
                      <Badge variant={r.daysLate > 60 ? 'destructive' : r.daysLate > 0 ? 'secondary' : 'outline'} className="text-[10px]">
                        {r.daysLate > 0 ? `${r.daysLate}d late` : 'Current'}
                      </Badge>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-medium">{money(r.amount)}</td>
                    <td className="py-1.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => chaseWhatsApp(r)}>
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => chaseSMS(r)}>
                          <Smartphone className="h-3 w-3" /> SMS
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}