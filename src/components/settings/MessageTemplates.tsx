import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  TEMPLATES,
  TEMPLATE_TOKENS,
  TemplateMap,
  loadTemplates,
  saveTemplates,
} from '@/lib/messageTemplates';

export function MessageTemplates() {
  const [map, setMap] = useState<TemplateMap>(() => loadTemplates());

  const commit = (next: TemplateMap) => {
    setMap(next);
    saveTemplates(next);
  };

  const preview = (text: string) => {
    const values: Record<string, string> = {
      '{name}': 'Sipho',
      '{ref}': 'INV-0042',
      '{amount}': 'E4 500.00',
      '{due}': '12 Aug 2026',
      '{days}': '14',
      '{business}': 'HustleOS',
    };
    return text
      .replace(/\{name\}|\{ref\}|\{amount\}|\{due\}|\{days\}|\{business\}/g, m => values[m] ?? m)
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  };

  return (
    <Card className="p-6">
      <h2 className="font-heading font-semibold text-lg mb-1">WhatsApp &amp; SMS templates</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Edit the wording used when you chase quotes, remind clients about invoices, or confirm payment.
        Changes save to this browser and apply everywhere the Chase buttons appear.
      </p>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TEMPLATE_TOKENS.map(t => (
          <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>
        ))}
      </div>

      <div className="space-y-6">
        {TEMPLATES.map(t => {
          const value = map[t.key] ?? t.default;
          return (
            <div key={t.key}>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`tpl-${t.key}`}>{t.label}</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => {
                    const next = { ...map };
                    delete next[t.key];
                    commit(next);
                    toast.success(`${t.label} reset to default`);
                  }}
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{t.hint}</p>
              <Textarea
                id={`tpl-${t.key}`}
                value={value}
                rows={3}
                className="mt-1.5 text-sm"
                onChange={e => commit({ ...map, [t.key]: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                <span className="font-medium text-foreground">Preview: </span>
                {preview(value)}
              </p>
            </div>
          );
        })}
      </div>

      <Button
        className="mt-6 gap-2"
        onClick={() => { saveTemplates(map); toast.success('Templates saved'); }}
      >
        <Save className="h-4 w-4" /> Save templates
      </Button>
    </Card>
  );
}
