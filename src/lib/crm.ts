import { supabase } from '@/integrations/supabase/client';
import { QuoteDocument, calculateGrandTotal, calculateCostTotal } from '@/types/document';

/* ---------------- Auto pipeline sync ---------------- */

export type DealStage = 'lead' | 'proposal' | 'negotiation' | 'won' | 'lost';

/**
 * Maps HustleOS document types to CRM deal stages.
 * quote -> Proposal, invoice -> Negotiation, receipt -> Won.
 */
export function stageForDocument(type: QuoteDocument['type']): DealStage {
  if (type === 'receipt') return 'won';
  if (type === 'invoice') return 'negotiation';
  return 'proposal';
}

/**
 * Finds an existing client by name or auto-creates a new record in the `clients` table.
 * Ensures BusinessOS client list stays synchronized with HustleOS document contacts.
 */
export async function getOrCreateClientId(
  clientInfo: QuoteDocument['clientInfo'],
  userId: string
): Promise<string | null> {
  const cleanName = clientInfo?.name?.trim();
  if (!cleanName) return null;

  try {
    // 1. Check for an existing client (case-insensitive)
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', cleanName)
      .maybeSingle();

    if (existing) return existing.id;

    // 2. Auto-create client if not found
    const { data: created, error } = await supabase
      .from('clients')
      .insert({
        user_id: userId,
        name: cleanName,
        email: clientInfo.email?.trim() || null,
        phone: clientInfo.phone?.trim() || null,
        address: clientInfo.address?.trim() || null,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.warn('Could not auto-create client in CRM:', error.message);
      return null;
    }

    return created?.id ?? null;
  } catch (err) {
    console.error('Error during client sync:', err);
    return null;
  }
}

/**
 * Keeps the sales pipeline in sync with documents.
 * Creates the deal on first sight, then only moves it forward (never backwards),
 * so manual drags to "Lost" or custom stages are preserved.
 */
export async function syncDealForDocument(doc: QuoteDocument, userId: string) {
  try {
    const value = calculateGrandTotal(doc.items, doc.taxRate);
    const stage = stageForDocument(doc.type);
    const title = doc.title?.trim() || `${doc.type.toUpperCase()} - ${doc.quoteNumber || 'Doc'}`;

    // 1. Check if a deal is already linked to this document
    const { data: existing } = await supabase
      .from('deals')
      .select('id, stage, client_id')
      .eq('document_id', doc.id)
      .maybeSingle();

    // 2. Link or auto-create client in BusinessOS
    let clientId = existing?.client_id ?? null;
    if (!clientId && doc.clientInfo?.name) {
      clientId = await getOrCreateClientId(doc.clientInfo, userId);
    }

    if (existing) {
      const order: DealStage[] = ['lead', 'proposal', 'negotiation', 'won'];
      const currentIdx = order.indexOf(existing.stage as DealStage);
      const nextIdx = order.indexOf(stage);
      const patch: Record<string, unknown> = { title, value };

      if (clientId && !existing.client_id) {
        patch.client_id = clientId;
      }

      // Don't override manual "lost" or a stage further along
      if (existing.stage !== 'lost' && nextIdx > currentIdx) {
        patch.stage = stage;
      }

      await supabase.from('deals').update(patch).eq('id', existing.id);
      return;
    }

    // 3. Create a new deal in the pipeline
    await supabase.from('deals').insert({
      user_id: userId,
      document_id: doc.id,
      client_id: clientId,
      title,
      value,
      stage,
      stage_order: 0,
      notes: `Auto-created from ${doc.type} (${doc.quoteNumber || 'Document'})`,
      expected_close_date: doc.dueDate ?? null,
    });
  } catch (e) {
    console.error('Pipeline sync failed:', e);
  }
}

/* ---------------- Client Scorecard Analytics ---------------- */

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

/**
 * Calculates financial scorecards & ratings for a specific client based on their history.
 */
export function scoreClient(docs: QuoteDocument[]): ClientScore {
  if (!docs.length) {
    return {
      lifetimeRevenue: 0,
      quotedValue: 0,
      jobsWon: 0,
      quotesSent: 0,
      winRate: 0,
      avgJobSize: 0,
      grossProfit: 0,
      marginPct: 0,
      outstanding: 0,
      lastActivity: null,
      rating: 'C',
    };
  }

  const receipts = docs.filter(d => d.type === 'receipt');
  const invoices = docs.filter(d => d.type === 'invoice');
  const quotes = docs.filter(d => d.type === 'quote');

  const total = (d: QuoteDocument) => calculateGrandTotal(d.items, d.taxRate);

  const lifetimeRevenue = receipts.reduce((s, d) => s + total(d), 0);
  const quotedValue = docs.reduce((s, d) => s + total(d), 0);
  const outstanding = invoices.reduce((s, d) => s + total(d), 0);
  const costs = receipts.reduce((s, d) => s + calculateCostTotal(d.costItems ?? []), 0);
  const grossProfit = lifetimeRevenue - costs;

  const jobsWon = receipts.length;
  const quotesSent = quotes.length || docs.length;
  const winRate = quotesSent ? (jobsWon / quotesSent) * 100 : 0;
  const avgJobSize = jobsWon ? lifetimeRevenue / jobsWon : 0;
  const marginPct = lifetimeRevenue ? (grossProfit / lifetimeRevenue) * 100 : 0;

  // Find most recent document date safely
  const sortedDates = docs
    .map(d => d.issueDate || d.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const lastActivity = sortedDates.length ? sortedDates[0] : null;

  // Grade client: A (High revenue + high win rate), B (Active customer), C (Lead/Unconverted)
  const rating: ClientScore['rating'] =
    lifetimeRevenue > 0 && winRate >= 50 ? 'A' : lifetimeRevenue > 0 ? 'B' : 'C';

  return {
    lifetimeRevenue,
    quotedValue,
    jobsWon,
    quotesSent,
    winRate,
    avgJobSize,
    grossProfit,
    marginPct,
    outstanding,
    lastActivity,
    rating,
  };
}