/**
 * Customizable WhatsApp / SMS message templates.
 * Stored per-browser in localStorage so users can edit the wording
 * used for quote chases, invoice reminders and confirmations.
 */

export type TemplateKey =
  | 'quote_chase'
  | 'invoice_due'
  | 'invoice_late'
  | 'invoice_very_late'
  | 'follow_up'
  | 'confirmation';

export interface TemplateMeta {
  key: TemplateKey;
  label: string;
  hint: string;
  default: string;
}

export const TEMPLATE_TOKENS = ['{name}', '{ref}', '{amount}', '{due}', '{days}', '{business}'] as const;

export const TEMPLATES: TemplateMeta[] = [
  {
    key: 'quote_chase',
    label: 'Quote chase',
    hint: 'Sent when a quote has had no answer.',
    default: 'Hi {name}, just following up on quote {ref} for {amount}. Would you like us to proceed?',
  },
  {
    key: 'invoice_due',
    label: 'Invoice not yet due',
    hint: 'A polite heads-up before the due date.',
    default: 'Hi {name}, just a heads-up that invoice {ref} for {amount} is due on {due}. Thank you.',
  },
  {
    key: 'invoice_late',
    label: 'Invoice late (1–60 days)',
    hint: 'Friendly reminder once payment is late.',
    default: 'Hi {name}, a friendly reminder that invoice {ref} for {amount} was due on {due} and is {days} days late. Kindly let me know when payment will be made. Thank you.',
  },
  {
    key: 'invoice_very_late',
    label: 'Invoice very late (60+ days)',
    hint: 'Firmer wording for seriously overdue accounts.',
    default: 'Hi {name}, invoice {ref} for {amount} is now {days} days overdue (due {due}). Please arrange payment urgently or let me know a firm date. Thank you.',
  },
  {
    key: 'follow_up',
    label: 'Client follow-up',
    hint: 'Used for follow-up tasks in the inbox.',
    default: 'Hi {name}, following up on: {ref}',
  },
  {
    key: 'confirmation',
    label: 'Payment confirmation',
    hint: 'Thank-you message once money is received.',
    default: 'Hi {name}, thank you — payment of {amount} for {ref} has been received. We appreciate your business. {business}',
  },
];

const STORAGE_KEY = 'messageTemplates:v1';

export type TemplateMap = Partial<Record<TemplateKey, string>>;

export function loadTemplates(): TemplateMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TemplateMap) : {};
  } catch {
    return {};
  }
}

export function saveTemplates(map: TemplateMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

export function getTemplate(key: TemplateKey): string {
  const custom = loadTemplates()[key];
  if (custom && custom.trim()) return custom;
  return TEMPLATES.find(t => t.key === key)?.default ?? '';
}

export interface TemplateVars {
  name?: string;
  ref?: string;
  amount?: string;
  due?: string;
  days?: string | number;
  business?: string;
}

export function fillTemplate(key: TemplateKey, vars: TemplateVars): string {
  const values: Record<string, string> = {
    '{name}': vars.name?.trim() || 'there',
    '{ref}': vars.ref ?? '',
    '{amount}': vars.amount ?? '',
    '{due}': vars.due ?? '',
    '{days}': String(vars.days ?? ''),
    '{business}': vars.business ?? '',
  };
  return getTemplate(key)
    .replace(/\{name\}|\{ref\}|\{amount\}|\{due\}|\{days\}|\{business\}/g, m => values[m] ?? m)
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
