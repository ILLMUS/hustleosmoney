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
import { Plus, Trash2, MapPin, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { MEETING_STATUSES, prettyLabel, statusTone } from "@/lib/salesCrm";

interface Meeting {
  id: string;
  title: string;
  meeting_at: string;
  duration_min: number;
  location: string;
  agenda: string;
  outcome: string;
  status: string;
  client_id: string | null;
  lead_id: string | null;
  member_id: string | null;
}

interface Option { id: string; name: string }

function toLocalInput(date: Date) {
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
}

const emptyForm = () => ({
  title: "",
  meeting_at: toLocalInput(new Date(Date.now() + 3600_000)),
  duration_min: "30",
  location: "",
  agenda: "",
  status: "scheduled",
  client_id: "none",
  lead_id: "none",
  member_id: "none",
});

export default function Meetings() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [leads, setLeads] = useState<Option[]>([]);
  const [members, setMembers] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [tab, setTab] = useState<"upcoming" | "past" | "all">("upcoming");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [mRes, cRes, lRes, tRes] = await Promise.all([
      supabase.from("meetings").select("*").order("meeting_at", { ascending: true }),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("leads").select("id, name").order("created_at", { ascending: false }),
      supabase.from("team_members").select("id, name").order("name"),
    ]);
    setMeetings((mRes.data as Meeting[]) || []);
    setClients(cRes.data || []);
    setLeads(lRes.data || []);
    setMembers(tRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const nameOf = (list: Option[], id: string | null) => list.find((o) => o.id === id)?.name;

  const visible = useMemo(() => {
    const now = Date.now();
    return meetings.filter((m) => {
      const t = new Date(m.meeting_at).getTime();
      if (tab === "upcoming") return t >= now && m.status === "scheduled";
      if (tab === "past") return t < now || m.status !== "scheduled";
      return true;
    });
  }, [meetings, tab]);

  const createMeeting = async () => {
    if (!user || !form.title.trim()) { toast.error("Title is required"); return; }
    const { error } = await supabase.from("meetings").insert({
      user_id: user.id,
      title: form.title.trim(),
      meeting_at: new Date(form.meeting_at).toISOString(),
      duration_min: parseInt(form.duration_min) || 30,
      location: form.location,
      agenda: form.agenda,
      status: form.status,
      client_id: form.client_id === "none" ? null : form.client_id,
      lead_id: form.lead_id === "none" ? null : form.lead_id,
      member_id: form.member_id === "none" ? null : form.member_id,
    });
    if (error) { toast.error("Could not schedule meeting"); return; }
    toast.success("Meeting scheduled");
    setOpen(false);
    setForm(emptyForm());
    fetchData();
  };

  const patchMeeting = async (id: string, patch: Partial<Meeting>) => {
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const { error } = await supabase.from("meetings").update(patch).eq("id", id);
    if (error) { toast.error("Update failed"); fetchData(); }
  };

  const removeMeeting = async (id: string) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) { toast.error("Delete failed"); fetchData(); }
    else toast.success("Meeting removed");
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">All Meetings</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Site visits, client calls and follow-up sessions.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Schedule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">New meeting</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Site visit — roof measure" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Date & time</Label>
                  <Input type="datetime-local" value={form.meeting_at} onChange={(e) => setForm({ ...form, meeting_at: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="On site / Zoom / Office" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Client</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Lead</Label>
                  <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Assigned to</Label>
                <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Agenda</Label>
                <Textarea rows={2} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
              </div>
              <Button onClick={createMeeting} className="w-full">Schedule meeting</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-1.5 mb-4">
        {(["upcoming", "past", "all"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {prettyLabel(t)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading meetings...</div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nothing here yet.</Card>
      ) : (
        <div className="grid gap-3">
          {visible.map((m) => {
            const when = new Date(m.meeting_at);
            return (
              <Card key={m.id} className="p-3 sm:p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-center min-w-[64px]">
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {when.toLocaleDateString(undefined, { month: "short" })}
                    </p>
                    <p className="font-heading font-bold text-lg leading-none">{when.getDate()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-[180px] space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-heading font-semibold text-sm">{m.title}</p>
                      <Badge variant="outline" className={`text-[10px] ${statusTone(m.status)}`}>
                        {prettyLabel(m.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.duration_min} min</span>
                      {m.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</span>}
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />
                        {nameOf(clients, m.client_id) || nameOf(leads, m.lead_id) || "No contact"}
                      </span>
                      {m.member_id && <span>Rep: {nameOf(members, m.member_id)}</span>}
                    </div>
                    {m.agenda && <p className="text-xs text-muted-foreground line-clamp-2">{m.agenda}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Select value={m.status} onValueChange={(v) => patchMeeting(m.id, { status: v })}>
                      <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MEETING_STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeMeeting(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}