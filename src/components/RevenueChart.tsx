import { useMemo } from 'react';
import { useDocuments } from '@/context/DocumentContext';
import { calculateGrandTotal } from '@/types/document';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, startOfMonth, subMonths, parseISO, isValid } from 'date-fns';
import { TrendingUp, DollarSign } from 'lucide-react';

function formatCurrency(amount: number) {
  return `E${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function RevenueChart() {
  const { documents, loading } = useDocuments();

  // Aggregate monthly revenues for the last 6 months
  const { chartData, total6MonthRevenue } = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      months.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') });
    }

    const totals: Record<string, number> = {};
    let runningTotal = 0;

    documents
      .filter(d => d.type === 'receipt')
      .forEach(doc => {
        const dateStr = doc.issueDate || doc.createdAt;
        if (!dateStr) return;

        const dateObj = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
        if (!isValid(dateObj)) return;

        const monthKey = format(dateObj, 'yyyy-MM');
        const revenue = calculateGrandTotal(doc.items, doc.taxRate);

        totals[monthKey] = (totals[monthKey] || 0) + revenue;
        runningTotal += revenue;
      });

    const chartData = months.map(m => ({
      month: m.label,
      revenue: totals[m.key] || 0,
    }));

    return { chartData, total6MonthRevenue: runningTotal };
  }, [documents]);

  const hasData = chartData.some(d => d.revenue > 0);

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
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground">Monthly Revenue</h3>
          {hasData && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span>6-Month Total: <strong className="text-foreground">{formatCurrency(total6MonthRevenue)}</strong></span>
            </p>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Receipts Ledger
        </span>
      </div>

      {!hasData ? (
        <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-lg bg-muted/20">
          <DollarSign className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-xs font-medium text-muted-foreground">No paid receipts recorded yet</p>
          <p className="text-[11px] text-muted-foreground/70">
            When you convert an invoice to a receipt or issue a direct receipt, monthly earnings will chart here automatically.
          </p>
        </div>
      ) : (
        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="month"
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
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}