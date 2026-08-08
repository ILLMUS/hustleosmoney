import { supabase } from '@/integrations/supabase/client';
import { QuoteDocument, calculateGrandTotal, calculateCostTotal } from '@/types/document';

/* ---------------- Auto pipeline sync ---------------- */

export type DealStage = 'lead' | 'proposal' | 'negotiation' | 'won' | 'lost';

export function stageForDocument(type: QuoteDocument['type']): DealStage {
  if (type === 'receipt') return 'won';
  if (type === 'invoice') return 'negotiation';
  return 'proposal';
}

/**
 * Keeps the sales pipeline in sync with documents.
 * quote -> Proposal, invoice -> Negotiation, receipt -> Won.
 * Creates the deal on first sight, then only moves it forward (never backwards),
 * so manual drags to "Lost" or ahead of the document are preserved.
 */
export async function syncDealForDocument(doc: QuoteDocument, userId: string) {
  try {
    const value = calculateGrandTotal(doc.items, doc.taxRate);
    const stage = stageForDocument(doc.type);
    const title = doc.title?.trim() || doc.quoteNumber;

    const { data: existing } = await supabase
      .from('deals')
      .select('id, stage')
      .eq('document_id', doc.id)
      .maybeSingle();

    if (existing) {
      const order: DealStage[] = ['lead', 'proposal', 'negotiation', 'won'];
      const currentIdx = order.indexOf(existing.stage as DealStage);
      const nextIdx = order.indexOf(stage);
      const patch: Record<string, unknown> = { title, value };
      // don't override manual "lost" or a stage further along
      if (existing.stage !== 'lost' && nextIdx > currentIdx) patch.stage = stage;
      await supabase.from('deals').update(patch).eq('id', existing.id);
      return;
    }

    // best-effort client link by name
    let clientId: string | null = null;
    if (doc.clientInfo?.name) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', doc.clientInfo.name.trim())
        .maybeSingle();
      clientId = client?.id ?? null;
    }

    await supabase.from('deals').insert({
      user_id: userId,
      document_id: doc.id,
      client_id: clientId,
      title,
      value,
      stage,
      stage_order: 0,
      notes: 'Auto-created from document',
      expected_close_date: doc.dueDate ?? null,
    });
  } catch (e) {
    console.error('Pipeline sync failed', e);
  }
}

/* ---------------- Client scorecard ---------------- */

export interface ClientScore {
  lifetimeRevenue: number;
  quotedValue: number;
  jobsWon: number;
  quotesSent: number;
  winRate: number;
  avgJobSize: number;
  grossProfit: number;
  marginPct: number;
  outstanding: number;
  lastActivity: string | null;
  rating: 'A' | 'B' | 'C';
}

export function scoreClient(docs: QuoteDocument[]): ClientScore {
  const receipts = docs.filter(d => d.type === 'receipt');
  const invoices = docs.filter(d => d.type === 'invoice');
  const quotes = docs.filter(d => d.type === 'quote');

  const total = (d: QuoteDocument) => calculateGrandTotal(d.items, d.taxRate);
  const lifetimeRevenue = receipts.reduce((s, d) => s + total(d), 0);
  const quotedValue = docs.reduce((s, d) => s + total(d), 0);
  const outstanding = invoices.reduce((s, d) => s + total(d), 0);
  const costs = receipts.reduce((s, d) => s + calculateCostTotal(d.costItems), 0);
  const grossProfit = lifetimeRevenue - costs;

  const jobsWon = receipts.length;
  const quotesSent = docs.length;
  const winRate = quotesSent ? (jobsWon / quotesSent) * 100 : 0;
  const avgJobSize = jobsWon ? lifetimeRevenue / jobsWon : 0;
  const marginPct = lifetimeRevenue ? (grossProfit / lifetimeRevenue) * 100 : 0;

  const lastActivity = docs.length
    ? docs.map(d => d.createdAt).sort().slice(-1)[0]
    : null;

  const rating: ClientScore['rating'] =
    lifetimeRevenue > 0 && winRate >= 50 ? 'A' : lifetimeRevenue > 0 ? 'B' : 'C';

  return {
    lifetimeRevenue,
    quotedValue,
    jobsWon,
    quotesSent: quotes.length || quotesSent,
    winRate,
    avgJobSize,
    grossProfit,
    marginPct,
    outstanding,
    lastActivity,
    rating,
  };
}
