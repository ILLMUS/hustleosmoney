import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useDocuments } from '@/context/DocumentContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateGrandTotal, QuoteDocument } from '@/types/document';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarClock, MessageCircle, FileText, StickyNote, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';
import { fillTemplate } from '@/lib/messageTemplates';

interface NoteRow {
  id: string;
  client_id: string;
  content: string;
  follow_up_date: string | null;
  is_completed: boolean;
}

type TaskKind = 'follow_up' | 'overdue_invoice' | 'stale_quote';

interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  subtitle: string;
  dueDate: string | null;
  daysOverdue: number;
  amount?: number;
  clientName?: string;
  phone?: string;
  href?: string;
  noteId?: string;
}

const fmt = (n: number) =>
  `E${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const KIND_META: Record<TaskKind, { label: string; icon: typeof StickyNote }> = {
  follow_up: { label: 'Follow-up', icon: StickyNote },
  overdue_invoice: { label: 'Unpaid invoice', icon: AlertTriangle },
  stale_quote: { label: 'Quote needs chasing', icon: FileText },
};

export default function Inbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { documents } = useDocuments();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [clients, setClients] = useState<Record<string, { name: string; phone: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [notesRes, clientsRes] = await Promise.all([
      supabase.from('client_notes').select('id, client_id, content, follow_up_date, is_completed').eq('is_completed', false),
      supabase.from('clients').select('id, name, phone'),
    ]);
    setNotes(notesRes.data || []);
    const map: Record<string, { name: string; phone: string | null }> = {};
    (clientsRes.data || []).forEach(c => { map[c.id] = { name: c.name, phone: c.phone }; });
    setClients(map);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const today = new Date();

  const tasks = useMemo<Task[]>(() => {
    const out: Task[] = [];

    // 1. Client follow-ups
    notes.filter(n => n.follow_up_date).forEach(n => {
      const client = clients[n.client_id];
      out.push({
        id: `note-${n.id}`,
        kind: 'follow_up',
        title: n.content.split('\n')[0].slice(0, 90),
        subtitle: client?.name ?? 'Client',
        dueDate: n.follow_up_date,
        daysOverdue: differenceInCalendarDays(today, new Date(n.follow_up_date as string)),
        clientName: client?.name,
        phone: client?.phone ?? undefined,
        href: `/clients/${n.client_id}`,
        noteId: n.id,
      });
    });

    // 2. Unpaid invoices (no receipt raised)
    const receiptQuoteNumbers = new Set(documents.filter(d => d.type === 'receipt').map(d => d.quoteNumber));
    documents.filter(d => d.type === 'invoice' && !receiptQuoteNumbers.has(d.quoteNumber)).forEach((d: QuoteDocument) => {
      const due = d.dueDate ?? d.issueDate ?? d.createdAt.slice(0, 10);
      out.push({
        id: `inv-${d.id}`,
        kind: 'overdue_invoice',
        title: `${d.invoiceNumber ?? d.quoteNumber} · ${d.title || 'Invoice'}`,
        subtitle: d.clientInfo.name || 'Client',
        dueDate: due,
        daysOverdue: differenceInCalendarDays(today, new Date(due)),
        amount: calculateGrandTotal(d.items, d.taxRate),
        clientName: d.clientInfo.name,
        phone: d.clientInfo.phone,
        href: `/preview/${d.id}`,
      });
    });

    // 3. Quotes with no movement for 7+ days
    const laterNumbers = new Set(documents.filter(d => d.type !== 'quote').map(d => d.quoteNumber));
    documents.filter(d => d.type === 'quote' && !laterNumbers.has(d.quoteNumber)).forEach(d => {
      const sent = d.issueDate ?? d.createdAt.slice(0, 10);
      const age = differenceInCalendarDays(today, new Date(sent));
      if (age < 7) return;
      out.push({
        id: `q-${d.id}`,
        kind: 'stale_quote',
        title: `${d.quoteNumber} · ${d.title || 'Quote'}`,
        subtitle: `${d.clientInfo.name || 'Client'} · sent ${age} days ago`,
        dueDate: sent,
        daysOverdue: age - 7,
        amount: calculateGrandTotal(d.items, d.taxRate),
        clientName: d.clientInfo.name,
        phone: d.clientInfo.phone,
        href: `/preview/${d.id}`,
      });
    });

    return out.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [notes, clients, documents]);

  const overdue = tasks.filter(t => t.daysOverdue > 0);
  const dueToday = tasks.filter(t => t.daysOverdue === 0);
  const upcoming = tasks.filter(t => t.daysOverdue < 0);

  const completeNote = async (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    const { error } = await supabase.from('client_notes').update({ is_completed: true }).eq('id', noteId);
    if (error) { toast.error('Could not complete task'); load(); }
    else toast.success('Task done');
  };

  const chase = (task: Task) => {
    const phone = (task.phone || '').replace(/[^\d]/g, '');
    const key =
      task.kind === 'overdue_invoice'
        ? task.daysOverdue > 60
          ? 'invoice_very_late'
          : task.daysOverdue > 0
          ? 'invoice_late'
          : 'invoice_due'
        : task.kind === 'stale_quote'
        ? 'quote_chase'
        : 'follow_up';
    const msg = fillTemplate(key, {
      name: task.clientName,
      ref: task.title,
      amount: task.amount !== undefined ? fmt(task.amount) : '',
      due: task.dueDate ? format(new Date(task.dueDate), 'dd MMM yyyy') : '',
      days: Math.max(0, task.daysOverdue),
    });
    if (!phone) { toast.error('No phone number on file'); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const TaskList = ({ items }: { items: Task[] }) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <p className="text-sm">Nothing here — you're clear.</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {items.map(task => {
          const Meta = KIND_META[task.kind];
          const Icon = Meta.icon;
          return (
            <Card key={task.id} className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                {task.noteId ? (
                  <Checkbox className="mt-1" onCheckedChange={() => completeNote(task.noteId!)} />
                ) : (
                  <Icon className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <Badge variant="outline" className="text-[10px]">{Meta.label}</Badge>
                    {task.daysOverdue > 0 && (
                      <Badge variant="destructive" className="text-[10px]">{task.daysOverdue}d overdue</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.subtitle}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> {format(new Date(task.dueDate), 'dd MMM yyyy')}
                      </span>
                    )}
                    {task.amount !== undefined && <span className="font-heading font-semibold text-foreground">{fmt(task.amount)}</span>}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => chase(task)}>
                    <MessageCircle className="h-3 w-3" /> Chase
                  </Button>
                  {task.href && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(task.href!)}>
                      Open
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 sm:py-5 px-3 sm:px-4">
          <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">Task inbox</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Follow-ups, unpaid invoices and quotes waiting on an answer</p>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading tasks...</div>
        ) : (
          <Tabs defaultValue="overdue">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="overdue" className="flex-1 sm:flex-none">Overdue ({overdue.length})</TabsTrigger>
              <TabsTrigger value="today" className="flex-1 sm:flex-none">Today ({dueToday.length})</TabsTrigger>
              <TabsTrigger value="upcoming" className="flex-1 sm:flex-none">Upcoming ({upcoming.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="overdue" className="mt-4"><TaskList items={overdue} /></TabsContent>
            <TabsContent value="today" className="mt-4"><TaskList items={dueToday} /></TabsContent>
            <TabsContent value="upcoming" className="mt-4"><TaskList items={upcoming} /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
