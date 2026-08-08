import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
}

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "sales_rep" });

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("team_members").select("*").order("name");
    setMembers((data as Member[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addMember = async () => {
    if (!user || !form.name.trim()) { toast.error("Name is required"); return; }
    const { error } = await supabase.from("team_members").insert({
      user_id: user.id,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
    });
    if (error) { toast.error("Could not add member"); return; }
    toast.success("Team member added");
    setOpen(false);
    setForm({ name: "", email: "", phone: "", role: "sales_rep" });
    fetchData();
  };

  const toggleActive = async (m: Member) => {
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await supabase.from("team_members").update({ is_active: !m.is_active }).eq("id", m.id);
    if (error) { toast.error("Update failed"); fetchData(); }
  };

  const removeMember = async (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) { toast.error("Delete failed"); fetchData(); }
    else toast.success("Member removed");
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">Sales team</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Reps you can assign leads, deals and meetings to.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add member</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="font-heading">New team member</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} />
              </div>
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} />
              </div>
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} maxLength={60} />
              </div>
              <Button onClick={addMember} className="w-full">Add member</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading team...</div>
      ) : members.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No team members yet. Add reps to track who owns each lead and deal.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <Card key={m.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-sm truncate">{m.name}</p>
                  <Badge variant="secondary" className="text-[10px] mt-1">{m.role}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeMember(m.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                {m.email && <p className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{m.email}</p>}
                {m.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</p>}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} />
                <span className="text-xs text-muted-foreground">{m.is_active ? "Active" : "Inactive"}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}