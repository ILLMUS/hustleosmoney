import { Fragment, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useDocuments } from '@/context/DocumentContext';
import { QuoteDocument, calculateGrandTotal, calculateCostTotal, costItemLabel } from '@/types/document';
import { money } from '@/lib/accounting';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Job {
  doc: QuoteDocument;
  client: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  date: string;
}

const buildJob = (d: QuoteDocument): Job => {
  const revenue = calculateGrandTotal(d.items ?? [], d.taxRate || 0);
  const cost = calculateCostTotal(d.costItems);
  const profit = revenue - cost;
  return {
    doc: d,
    client: d.clientInfo?.name || 'Unknown client',
    revenue,
    cost,
    profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    date: (d.issueDate || d.createdAt).slice(0, 10),
  };
};

export function JobProfitability() {
  const { documents } = useDocuments();
  const navigate = useNavigate();
  const [sort, setSort] = useState<'profit' | 'margin' | 'recent'>('profit');
  const [openId, setOpenId] = useState<string | null>(null);

  const jobs = useMemo(() => {
    const list = documents.filter(d => d.type === 'receipt').map(buildJob);
    if (sort === 'margin') return [...list].sort((a, b) => b.marginPct - a.marginPct);
    if (sort === 'recent') return [...list].sort((a, b) => b.date.localeCompare(a.date));
    return [...list].sort((a, b) => b.profit - a.profit);
  }, [documents, sort]);

  const totals = useMemo(() => {
    const revenue = jobs.reduce((s, j) => s + j.revenue, 0);
    const cost = jobs.reduce((s, j) => s + j.cost, 0);
    return { revenue, cost, profit: revenue - cost, marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0 };
  }, [jobs]);

  const byClient = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number; jobs: number }>();
    jobs.forEach(j => {
      const cur = map.get(j.client) ?? { revenue: 0, cost: 0, jobs: 0 };
      cur.revenue += j.revenue; cur.cost += j.cost; cur.jobs += 1;
      map.set(j.client, cur);
    });
    return [...map.entries()]
      .map(([client, v]) => ({ client, ...v, profit: v.revenue - v.cost }))
      .sort((a, b) => b.profit - a.profit);
  }, [jobs]);

  const missingCosts = jobs.filter(j => j.cost === 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Revenue (receipts)</p>
          <p className="text-xl font-heading font-bold">{money(totals.revenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Job costs</p>
          <p className="text-xl font-heading font-bold">{money(totals.cost)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Gross profit</p>
          <p className="text-xl font-heading font-bold text-success">{money(totals.profit)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Average margin</p>
          <p className="text-xl font-heading font-bold">{totals.marginPct.toFixed(1)}%</p>
        </Card>
      </div>

      {missingCosts > 0 && (
        <Card className="p-3 text-xs text-muted-foreground">
          {missingCosts} job{missingCosts > 1 ? 's have' : ' has'} no cost breakdown, so their margin shows as 100%.
          Add Labour/Services/Margin/Other on the document to make these numbers real.
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {([['profit', 'Most profit'], ['margin', 'Best margin'], ['recent', 'Most recent']] as const).map(([v, label]) => (
          <Button key={v} size="sm" variant={sort === v ? 'default' : 'outline'} onClick={() => setSort(v)}>{label}</Button>
        ))}
      </div>

      <Card className="p-4">
        <p className="text-sm font-medium mb-2">Jobs</p>
        {jobs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No completed jobs yet — profitability is measured from receipts.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="py-1.5 pr-2 font-medium">Job</th>
                  <th className="py-1.5 pr-2 font-medium">Client</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Revenue</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Cost</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Profit</th>
                  <th className="py-1.5 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <Fragment key={j.doc.id}>
                    <tr
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                      onClick={() => setOpenId(openId === j.doc.id ? null : j.doc.id)}
                    >
                      <td className="py-1.5 pr-2 whitespace-nowrap">{j.doc.receiptNumber ?? j.doc.quoteNumber}</td>
                      <td className="py-1.5 pr-2 truncate max-w-[150px]">{j.client}</td>
                      <td className="py-1.5 pr-2 text-right">{money(j.revenue)}</td>
                      <td className="py-1.5 pr-2 text-right text-muted-foreground">{money(j.cost)}</td>
                      <td className={`py-1.5 pr-2 text-right font-medium ${j.profit < 0 ? 'text-destructive' : 'text-success'}`}>
                        {money(j.profit)}
                      </td>
                      <td className="py-1.5 text-right">
                        <Badge variant={j.marginPct < 20 ? 'destructive' : 'secondary'} className="text-[10px]">
                          {j.marginPct.toFixed(0)}%
                        </Badge>
                      </td>
                    </tr>
                    {openId === j.doc.id && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={6} className="py-2 px-2">
                          <p className="text-[11px] text-muted-foreground mb-1">
                            {j.doc.title || 'Job'} · {format(new Date(j.date), 'dd MMM yyyy')}
                          </p>
                          {(j.doc.costItems ?? []).length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">No cost breakdown captured.</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {(j.doc.costItems ?? []).map(ci => (
                                <li key={ci.id} className="flex justify-between text-[11px]">
                                  <span>{costItemLabel(ci)}{ci.description ? ` — ${ci.description}` : ''}</span>
                                  <span>{money(Number(ci.amount) || 0)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 mt-2 text-[11px]"
                            onClick={e => { e.stopPropagation(); navigate(`/preview/${j.doc.id}`); }}
                          >
                            Open document
                          </Button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium mb-2">By client</p>
        {byClient.length === 0 ? (
          <p className="text-xs text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-1.5">
            {byClient.map(c => (
              <div key={c.client} className="flex items-center justify-between text-xs sm:text-sm border-b last:border-0 py-1">
                <span className="truncate max-w-[45%]">{c.client} <span className="text-muted-foreground">({c.jobs})</span></span>
                <span className="text-muted-foreground">{money(c.revenue)} − {money(c.cost)}</span>
                <span className={`font-medium ${c.profit < 0 ? 'text-destructive' : 'text-success'}`}>{money(c.profit)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}