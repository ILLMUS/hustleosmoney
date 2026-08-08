import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LEAD_STATUSES, LEAD_SOURCES, formatCurrency, formatCompact, prettyLabel, statusTone, pct,
} from "@/lib/salesCrm";

interface LeadRow {
  id: string; name: string; status: string; source: string; value: number | null;
  owner_member_id: string | null; client_id: string | null; created_at: string;
}
interface DealRow {
  id: string; title: string; value: number; stage: string; client_id: string | null;
  owner_member_id: string | null; source: string | null; created_at: string;
}
interface DocRow { id: string; type: string; client_id: string | null; items: unknown; tax_rate: number; created_at: string }
interface NamedRow { id: string; name: string }

function inRange(iso: string, from: string, to: string) {
  const t = new Date(iso).getTime();
  return t >= new Date(`${from}T00:00:00`).getTime() && t <= new Date(`${to}T23:59:59`).getTime();
}

function docTotal(doc: DocRow) {
  const items = Array.isArray(doc.items) ? (doc.items as Array<Record<string, unknown>>) : [];
  const sub = items.reduce((s, it) => {
    const qty = Number(it.quantity ?? it.qty ?? 0);
    const price = Number(it.unitPrice ?? it.unit_price ?? it.price ?? 0);
    return s + qty * price;
  }, 0);
  return sub * (1 + Number(doc.tax_rate || 0) / 100);
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-heading font-bold text-lg sm:text-xl mt-1">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </Card>
  );
}

export default function SalesReports() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [clients, setClients] = useState<NamedRow[]>([]);
  const [members, setMembers] = useState<NamedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [l, d, dc, c, m] = await Promise.all([
      supabase.from("leads").select("id, name, status, source, value, owner_member_id, client_id, created_at"),
      supabase.from("deals").select("id, title, value, stage, client_id, owner_member_id, source, created_at"),
      supabase.from("documents").select("id, type, client_id, items, tax_rate, created_at"),
      supabase.from("clients").select("id, name"),
      supabase.from("team_members").select("id, name"),
    ]);
    setLeads((l.data as LeadRow[]) || []);
    setDeals((d.data as DealRow[]) || []);
    setDocs((dc.data as DocRow[]) || []);
    setClients((c.data as NamedRow[]) || []);
    setMembers((m.data as NamedRow[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fLeads = useMemo(() => leads.filter((l) => inRange(l.created_at, from, to)), [leads, from, to]);
  const fDeals = useMemo(() => deals.filter((d) => inRange(d.created_at, from, to)), [deals, from, to]);
  const fDocs = useMemo(() => docs.filter((d) => inRange(d.created_at, from, to)), [docs, from, to]);

  const summary = useMemo(() => {
    const won = fLeads.filter((l) => l.status === "won").length;
    const lost = fLeads.filter((l) => l.status === "lost").length;
    const open = fLeads.length - won - lost;
    const pipelineValue = fDeals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + Number(d.value), 0);
    const wonValue = fDeals.filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.value), 0);
    return { total: fLeads.length, won, lost, open, pipelineValue, wonValue, conv: pct(won, fLeads.length) };
  }, [fLeads, fDeals]);

  const byStatus = useMemo(
    () => LEAD_STATUSES.map((s) => ({
      ...s, count: fLeads.filter((l) => l.status === s.key).length,
    })),
    [fLeads],
  );

  const bySource = useMemo(() => {
    const keys = Array.from(new Set([...LEAD_SOURCES, ...fLeads.map((l) => l.source || "other")]));
    return keys
      .map((key) => {
        const rows = fLeads.filter((l) => (l.source || "other") === key);
        const won = rows.filter((l) => l.status === "won");
        const value = fDeals.filter((d) => (d.source || "other") === key && d.stage === "won")
          .reduce((s, d) => s + Number(d.value), 0);
        return { key, count: rows.length, won: won.length, value, winRate: pct(won.length, rows.length) };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [fLeads, fDeals]);

  const byMember = useMemo(() => {
    const rows = members.map((m) => {
      const mLeads = fLeads.filter((l) => l.owner_member_id === m.id);
      const mDeals = fDeals.filter((d) => d.owner_member_id === m.id);
      const won = mDeals.filter((d) => d.stage === "won");
      return {
        id: m.id,
        name: m.name,
        leads: mLeads.length,
        deals: mDeals.length,
        wonCount: won.length,
        wonValue: won.reduce((s, d) => s + Number(d.value), 0),
        openValue: mDeals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + Number(d.value), 0),
        winRate: pct(won.length, mDeals.length),
      };
    });
    const unLeads = fLeads.filter((l) => !l.owner_member_id);
    const unDeals = fDeals.filter((d) => !d.owner_member_id);
    const unWon = unDeals.filter((d) => d.stage === "won");
    rows.push({
      id: "unassigned",
      name: "Unassigned",
      leads: unLeads.length,
      deals: unDeals.length,
      wonCount: unWon.length,
      wonValue: unWon.reduce((s, d) => s + Number(d.value), 0),
      openValue: unDeals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + Number(d.value), 0),
      winRate: pct(unWon.length, unDeals.length),
    });
    return rows.sort((a, b) => b.wonValue - a.wonValue);
  }, [members, fLeads, fDeals]);

  const byClient = useMemo(() => {
    return clients
      .map((c) => {
        const cDocs = fDocs.filter((d) => d.client_id === c.id);
        const revenue = cDocs.filter((d) => d.type === "receipt").reduce((s, d) => s + docTotal(d), 0);
        const outstanding = cDocs.filter((d) => d.type === "invoice").reduce((s, d) => s + docTotal(d), 0);
        const quoted = cDocs.filter((d) => d.type === "quote").length;
        const jobs = cDocs.filter((d) => d.type === "receipt").length;
        return {
          id: c.id, name: c.name, revenue, outstanding, quoted, jobs,
          winRate: pct(jobs, cDocs.length),
          avgJob: jobs ? revenue / jobs : 0,
        };
      })
      .filter((r) => r.revenue > 0 || r.outstanding > 0 || r.quoted > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [clients, fDocs]);

  const maxStatus = Math.max(1, ...byStatus.map((s) => s.count));

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">Sales reports</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">Lead summary, team performance, clients and lead sources.</p>
      </div>

      <Card className="p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Crunching numbers...</div>
      ) : (
        <Tabs defaultValue="summary">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="summary">Lead summary</TabsTrigger>
            <TabsTrigger value="team">Team sales</TabsTrigger>
            <TabsTrigger value="clients">Client performance</TabsTrigger>
            <TabsTrigger value="sources">Lead source</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Leads" value={String(summary.total)} hint={`${summary.open} still open`} />
              <StatCard label="Conversion" value={`${summary.conv.toFixed(1)}%`} hint={`${summary.won} won / ${summary.lost} lost`} />
              <StatCard label="Open pipeline" value={formatCompact(summary.pipelineValue)} />
              <StatCard label="Won value" value={formatCompact(summary.wonValue)} />
            </div>
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-heading font-semibold">Leads by status</h3>
              {byStatus.map((s) => (
                <div key={s.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${statusTone(s.key)}`}>{s.label}</Badge>
                    </span>
                    <span className="text-muted-foreground">{s.count}</span>
                  </div>
                  <Progress value={(s.count / maxStatus) * 100} className="h-1.5" />
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <Card className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rep</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                    <TableHead className="text-right">Open value</TableHead>
                    <TableHead className="text-right">Won value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byMember.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.leads}</TableCell>
                      <TableCell className="text-right">{r.deals}</TableCell>
                      <TableCell className="text-right">{r.wonCount}</TableCell>
                      <TableCell className="text-right">{r.winRate.toFixed(0)}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.openValue)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.wonValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="clients" className="mt-4">
            <Card className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Quotes</TableHead>
                    <TableHead className="text-right">Jobs won</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                    <TableHead className="text-right">Avg job</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byClient.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No client activity in this range.</TableCell></TableRow>
                  ) : byClient.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.quoted}</TableCell>
                      <TableCell className="text-right">{r.jobs}</TableCell>
                      <TableCell className="text-right">{r.winRate.toFixed(0)}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.avgJob)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.outstanding)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="sources" className="mt-4">
            <Card className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                    <TableHead className="text-right">Won value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySource.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No leads in this range.</TableCell></TableRow>
                  ) : bySource.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{prettyLabel(r.key)}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right">{r.won}</TableCell>
                      <TableCell className="text-right">{r.winRate.toFixed(0)}%</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}