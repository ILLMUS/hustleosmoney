import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { money } from '@/lib/accounting';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface AuditLog {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  entry_id: string | null;
  action: string;
  summary: string;
  amount_before: number | null;
  amount_after: number | null;
  details: any;
  created_at: string;
}

const ENTITY_LABEL: Record<string, string> = {
  journal_entry: 'Journal entry',
  journal_line: 'Journal line',
  reconciliation: 'Reconciliation',
};

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  created: 'default',
  edited: 'secondary',
  deleted: 'destructive',
  reconciled: 'default',
  unreconciled: 'outline',
};

interface Props {
  userId: string;
  actorName: string;
  refreshKey?: number;
}

export function AuditTrail({ userId, actorName, refreshKey = 0 }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'journal' | 'reconciliation'>('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(300);
      if (!active) return;
      setLogs((data ?? []) as unknown as AuditLog[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId, refreshKey]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return logs.filter(l => {
      if (filter === 'journal' && l.entity_type === 'reconciliation') return false;
      if (filter === 'reconciliation' && l.entity_type !== 'reconciliation') return false;
      if (!term) return true;
      return (
        l.summary.toLowerCase().includes(term) ||
        l.action.toLowerCase().includes(term) ||
        (ENTITY_LABEL[l.entity_type] ?? l.entity_type).toLowerCase().includes(term)
      );
    });
  }, [logs, filter, q]);

  const change = (l: AuditLog) => {
    const b = l.amount_before;
    const a = l.amount_after;
    if (b == null && a == null) return '—';
    if (b == null) return money(Number(a));
    if (a == null) return money(Number(b));
    return `${money(Number(b))} → ${money(Number(a))}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {(['all', 'journal', 'reconciliation'] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="capitalize" onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
        <Input
          className="h-8 w-full sm:w-56"
          placeholder="Search activity…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <Card className="p-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading audit trail…</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="py-1.5 pr-2 font-medium whitespace-nowrap">When</th>
                  <th className="py-1.5 pr-2 font-medium">Who</th>
                  <th className="py-1.5 pr-2 font-medium">What</th>
                  <th className="py-1.5 pr-2 font-medium">Action</th>
                  <th className="py-1.5 font-medium text-right">Before → After</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(l => (
                  <tr key={l.id} className="border-b last:border-0 align-top">
                    <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">
                      {format(new Date(l.created_at), 'dd MMM yyyy HH:mm')}
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{l.actor_id ? actorName : 'System'}</td>
                    <td className="py-1.5 pr-2">
                      <span className="font-medium">{ENTITY_LABEL[l.entity_type] ?? l.entity_type}</span>
                      <span className="block text-muted-foreground truncate max-w-[240px]">{l.summary || '—'}</span>
                    </td>
                    <td className="py-1.5 pr-2">
                      <Badge variant={ACTION_VARIANT[l.action] ?? 'secondary'} className="text-[10px] capitalize">
                        {l.action}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap">{change(l)}</td>
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