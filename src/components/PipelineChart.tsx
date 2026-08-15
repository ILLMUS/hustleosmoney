import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Layers } from 'lucide-react';

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'hsl(220, 18%, 28%)' },
  { key: 'proposal', label: 'Proposal', color: 'hsl(40, 75%, 50%)' },
  { key: 'negotiation', label: 'Negotiation', color: 'hsl(30, 85%, 50%)' },
  { key: 'won', label: 'Won', color: 'hsl(142, 65%, 38%)' },
  { key: 'lost', label: 'Lost', color: 'hsl(0, 72%, 51%)' },
];

function formatCurrency(amount: number) {
  return `E${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function PipelineChart() {
  const { user } = useAuth();
  const [data, setData] = useState<{ stage: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch deal data from Supabase
  const fetchPipelineData = useCallback(async () => {
    if (!user) return;

    const { data: deals, error } = await supabase
      .from('deals')
      .select('stage, value')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching pipeline deals:', error);
      setLoading(false);
      return;
    }

    const totals: Record<string, number> = {};
    (deals || []).forEach(d => {
      totals[d.stage] = (totals[d.stage] || 0) + Number(d.value);
    });

    setData(STAGES.map(s => ({
      stage: s.label,
      value: totals[s.key] || 0,
      color: s.color,
    })));
    setLoading(false);
  }, [user]);

  // Initial fetch and Realtime subscription setup
  useEffect(() => {
    if (!user) return;

    fetchPipelineData();

    // 🔴 Supabase Realtime Listener for Deals
    const channel = supabase
      .channel(`public:deals:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Re-aggregate chart on any deal insert/update/delete
          fetchPipelineData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchPipelineData]);

  const hasData = data.some(d => d.value > 0);

  if (loading) {
    return (
      <Card className="p-4 mb-4 sm:mb-6 animate-pulse">
        <div className="h-4 bg-muted/60 rounded w-1/4 mb-4"></div>
        <div className="h-48 bg-muted/30 rounded"></div>
      </Card>
    );
  }

  return (
    <Card className="p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-foreground">Pipeline by Stage</h3>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Sales Deals
        </span>
      </div>

      {!hasData ? (
        <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-lg bg-muted/20">
          <Layers className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-xs font-medium text-muted-foreground">No active deals in your pipeline</p>
          <p className="text-[11px] text-muted-foreground/70">
            Convert a quote or add a deal from your documents to populate the pipeline chart.
          </p>
        </div>
      ) : (
        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCurrency}
                width={55}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Total Value']}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}