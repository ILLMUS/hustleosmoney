import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface PublicForm {
  id: string;
  slug: string;
  title: string;
  description: string;
  submit_label: string;
  thank_you_message: string;
}

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().max(200).email("Enter a valid email").or(z.literal("")),
  phone: z.string().trim().max(40),
  company: z.string().trim().max(160),
  notes: z.string().trim().max(2000),
});

export default function PublicLeadForm() {
  const { slug = "" } = useParams();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [values, setValues] = useState({ name: "", email: "", phone: "", company: "", notes: "" });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("get_public_lead_form", { _slug: slug });
      setForm((data as PublicForm[])?.[0] ?? null);
      setLoading(false);
    };
    load();
  }, [slug]);

  const submit = async () => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc("submit_public_lead", {
      _slug: slug,
      _name: parsed.data.name,
      _email: parsed.data.email,
      _phone: parsed.data.phone,
      _company: parsed.data.company,
      _notes: parsed.data.notes,
    });
    setSending(false);
    if (error) { toast.error("Could not send. Please try again."); return; }
    setDone(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-8 text-center max-w-sm">
          <h1 className="font-heading font-bold text-lg mb-1">Form unavailable</h1>
          <p className="text-sm text-muted-foreground">This link is inactive or no longer exists.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg p-6 sm:p-8">
        {done ? (
          <div className="text-center space-y-3 py-6">
            <CheckCircle2 className="h-10 w-10 mx-auto text-success" />
            <h1 className="font-heading font-bold text-xl">{form.title}</h1>
            <p className="text-sm text-muted-foreground">{form.thank_you_message}</p>
          </div>
        ) : (
          <>
            <h1 className="font-heading font-bold text-xl sm:text-2xl tracking-tight">{form.title}</h1>
            {form.description && (
              <p className="text-sm text-muted-foreground mt-1.5">{form.description}</p>
            )}
            <div className="grid gap-3 mt-6">
              <div className="grid gap-1.5">
                <Label>Your name *</Label>
                <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} maxLength={120} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Phone</Label>
                  <Input value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} maxLength={40} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} maxLength={200} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Company</Label>
                <Input value={values.company} onChange={(e) => setValues({ ...values, company: e.target.value })} maxLength={160} />
              </div>
              <div className="grid gap-1.5">
                <Label>What do you need?</Label>
                <Textarea rows={4} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} maxLength={2000} />
              </div>
              <Button onClick={submit} disabled={sending} className="w-full mt-1">
                {sending ? "Sending..." : form.submit_label}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}