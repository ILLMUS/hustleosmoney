import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/salesCrm";

interface LeadForm {
  id: string;
  slug: string;
  title: string;
  description: string;
  submit_label: string;
  thank_you_message: string;
  source_label: string;
  is_active: boolean;
  created_at: string;
}

const EMPTY = {
  title: "Request a quote",
  slug: "",
  description: "Tell us what you need and we will get back to you.",
  submit_label: "Send request",
  thank_you_message: "Thanks! We will be in touch shortly.",
  source_label: "web_form",
};

export default function LeadForms() {
  const { user } = useAuth();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [formsRes, leadsRes] = await Promise.all([
      supabase.from("lead_forms").select("*").order("created_at", { ascending: false }),
      supabase.from("leads").select("form_id"),
    ]);
    const tally: Record<string, number> = {};
    (leadsRes.data || []).forEach((l) => {
      if (l.form_id) tally[l.form_id] = (tally[l.form_id] || 0) + 1;
    });
    setForms((formsRes.data as LeadForm[]) || []);
    setCounts(tally);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const publicUrl = (slug: string) => `${window.location.origin}/f/${slug}`;

  const createForm = async () => {
    if (!user || !form.title.trim()) { toast.error("Title is required"); return; }
    const base = slugify(form.slug || form.title) || "lead-form";
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("lead_forms").insert({
      user_id: user.id,
      slug,
      title: form.title.trim(),
      description: form.description,
      submit_label: form.submit_label || "Send request",
      thank_you_message: form.thank_you_message,
      source_label: slugify(form.source_label) || "web_form",
    });
    if (error) { toast.error("Could not create form"); return; }
    toast.success("Form created");
    setOpen(false);
    setForm({ ...EMPTY });
    fetchData();
  };

  const toggleActive = async (f: LeadForm) => {
    setForms((prev) => prev.map((x) => (x.id === f.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await supabase.from("lead_forms").update({ is_active: !f.is_active }).eq("id", f.id);
    if (error) { toast.error("Update failed"); fetchData(); }
  };

  const removeForm = async (id: string) => {
    setForms((prev) => prev.filter((f) => f.id !== id));
    const { error } = await supabase.from("lead_forms").delete().eq("id", id);
    if (error) { toast.error("Delete failed"); fetchData(); }
    else toast.success("Form deleted");
  };

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">Lead capture forms</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Share a public link — every submission lands in All Leads.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New form</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">New capture form</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid gap-1.5">
                <Label>Form title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Intro text</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Button label</Label>
                  <Input value={form.submit_label} onChange={(e) => setForm({ ...form, submit_label: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Source tag</Label>
                  <Input value={form.source_label} onChange={(e) => setForm({ ...form, source_label: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Thank you message</Label>
                <Textarea rows={2} value={form.thank_you_message} onChange={(e) => setForm({ ...form, thank_you_message: e.target.value })} />
              </div>
              <Button onClick={createForm} className="w-full">Create form</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading forms...</div>
      ) : forms.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No forms yet. Create one to start collecting leads from your link or website.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.map((f) => (
            <Card key={f.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-sm truncate">{f.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{f.description}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {counts[f.id] || 0} leads
                </Badge>
              </div>
              <div className="rounded-md bg-muted/40 border px-2 py-1.5 text-[11px] break-all">
                {publicUrl(f.slug)}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch checked={f.is_active} onCheckedChange={() => toggleActive(f)} />
                  <span className="text-xs text-muted-foreground">{f.is_active ? "Active" : "Paused"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copyLink(f.slug)} title="Copy link">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Open form">
                    <a href={publicUrl(f.slug)} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeForm(f.id)}>
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