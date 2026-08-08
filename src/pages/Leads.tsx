import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Trash2, UserPlus, KanbanSquare, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  LEAD_SOURCES, LEAD_STATUSES, formatCurrency, prettyLabel, statusTone,
} from "@/lib/salesCrm";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: string;
  value: number;
  notes: string;
  owner_member_id: string | null;
  client_id: string | null;
  deal_id: string | null;
  next_follow_up: string | null;
  created_at: string;
}

interface Member { id: string; name: string }

const EMPTY = {
  name: "", email: "", phone: "", company: "",
  source: "manual", status: "new", value: "", notes: "",
  owner_member_id: "none", next_follow_up: "",
};

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [leadsRes, membersRes] = await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("team_members").select("id, name").order("name"),
    ]);
    setLeads((leadsRes.data as Lead[]) || []);
    setMembers(membersRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const memberName = (id: string | null) =>
    members.find((m) => m.id === id)?.name ?? "Unassigned";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (ownerFilter !== "all") {
        if (ownerFilter === "none" ? l.owner_member_id : l.owner_member_id !== ownerFilter) return false;
      }
      if (!q) return true;
      return [l.name, l.email, l.phone, l.company, l.notes]
        .join(" ").toLowerCase().includes(q);
    });
  }, [leads, search, statusFilter, sourceFilter, ownerFilter]);

  const totals = useMemo(() => ({
    count: filtered.length,
    value: filtered.reduce((s, l) => s + Number(l.value), 0),
    open: filtered.filter((l) => !["won", "lost"].includes(l.status)).length,
  }), [filtered]);

  const createLead = async () => {
    if (!user || !form.name.trim()) { toast.error("Name is required"); return; }
    const { error } = await supabase.from("leads").insert({
      user_id: user.id,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      source: form.source,
      status: form.status,
      value: parseFloat(form.value) || 0,
      notes: form.notes,
      owner_member_id: form.owner_member_id === "none" ? null : form.owner_member_id,
      next_follow_up: form.next_follow_up || null,
    });
    if (error) { toast.error("Could not save lead"); return; }
    toast.success("Lead added");
    setOpen(false);
    setForm({ ...EMPTY });
    fetchData();
  };

  const patchLead = async (id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) { toast.error("Update failed"); fetchData(); }
  };

  const removeLead = async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) { toast.error("Delete failed"); fetchData(); }
    else toast.success("Lead deleted");
  };

  const convertToClient = async (lead: Lead) => {
    if (!user) return;
    if (lead.client_id) { toast.info("Already linked to a client"); return; }
    const { data, error } = await supabase.from("clients").insert({
      user_id: user.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
    }).select("id").single();
    if (error || !data) { toast.error("Could not create client"); return; }
    await patchLead(lead.id, { client_id: data.id, status: "qualified" });
    toast.success("Client created from lead");
  };

  const pushToPipeline = async (lead: Lead) => {
    if (!user) return;
    if (lead.deal_id) { toast.info("Already in the pipeline"); return; }
    const { data, error } = await supabase.from("deals").insert({
      user_id: user.id,
      title: lead.company?.trim() ? `${lead.name} — ${lead.company}` : lead.name,
      value: Number(lead.value) || 0,
      stage: "lead",
      stage_order: 0,
      client_id: lead.client_id,
      owner_member_id: lead.owner_member_id,
      source: lead.source,
      notes: lead.notes || "Created from lead",
    }).select("id").single();
    if (error || !data) { toast.error("Could not create deal"); return; }
    await patchLead(lead.id, { deal_id: data.id });
    toast.success("Added to pipeline");
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">All Leads</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {totals.count} leads · {totals.open} open · {formatCurrency(totals.value)} estimated
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">New lead</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Company</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Source</Label>
                  <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{prettyLabel(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Estimated value</Label>
                  <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0.00" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Follow up</Label>
                  <Input type="date" value={form.next_follow_up} onChange={(e) => setForm({ ...form, next_follow_up: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Owner</Label>
                <Select value={form.owner_member_id} onValueChange={(v) => setForm({ ...form, owner_member_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button onClick={createLead} className="w-full">Save lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-3 mb-4 grid gap-2 sm:grid-cols-4">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search leads" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{prettyLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            <SelectItem value="none">Unassigned</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading leads...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No leads yet. Add one manually or share a capture form.
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((lead) => (
            <Card key={lead.id} className="p-3 sm:p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[180px] space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-heading font-semibold text-sm">{lead.name}</p>
                    <Badge variant="outline" className={`text-[10px] ${statusTone(lead.status)}`}>
                      {prettyLabel(lead.status)}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">{prettyLabel(lead.source)}</Badge>
                  </div>
                  {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                    {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                    <span>Owner: {memberName(lead.owner_member_id)}</span>
                    {lead.next_follow_up && <span>Follow up: {new Date(lead.next_follow_up).toLocaleDateString()}</span>}
                  </div>
                  {lead.notes && <p className="text-xs text-muted-foreground line-clamp-2">{lead.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-heading font-bold text-base text-primary">{formatCurrency(Number(lead.value))}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(lead.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Select value={lead.status} onValueChange={(v) => patchLead(lead.id, { status: v })}>
                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-8 w-8" title="Convert to client" onClick={() => convertToClient(lead)}>
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" title="Add to pipeline" onClick={() => pushToPipeline(lead)}>
                    <KanbanSquare className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeLead(lead.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}