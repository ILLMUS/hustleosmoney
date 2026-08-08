export const LEAD_STATUSES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "quoted", label: "Quoted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["key"];

export const LEAD_SOURCES = [
  "web_form",
  "referral",
  "walk_in",
  "whatsapp",
  "social",
  "cold_call",
  "repeat_client",
  "manual",
  "other",
];

export const MEETING_STATUSES = [
  { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" },
  { key: "no_show", label: "No show" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export const PIPELINE_STAGES = [
  { key: "lead", label: "Lead" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

export function formatCurrency(amount: number) {
  return `E${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompact(amount: number) {
  return `E${Number(amount || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

export function prettyLabel(value: string) {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function statusTone(status: string) {
  switch (status) {
    case "won":
    case "completed":
      return "bg-success/15 text-success border-success/30";
    case "lost":
    case "cancelled":
    case "no_show":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "qualified":
    case "quoted":
    case "negotiation":
      return "bg-warning/15 text-warning-foreground border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}