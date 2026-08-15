import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { QuoteDocument, initCounters, calculateCostTotal } from '@/types/document';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { syncDealForDocument } from '@/lib/crm';

interface DocumentContextType {
  documents: QuoteDocument[];
  loading: boolean;
  addDocument: (doc: QuoteDocument) => Promise<boolean>;
  updateDocument: (doc: QuoteDocument) => Promise<boolean>;
  deleteDocument: (id: string) => Promise<boolean>;
  refreshDocuments: () => Promise<void>;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

function toDbRow(doc: QuoteDocument, userId: string) {
  return {
    id: doc.id,
    user_id: userId,
    type: doc.type,
    quote_number: doc.quoteNumber,
    invoice_number: doc.invoiceNumber ?? null,
    receipt_number: doc.receiptNumber ?? null,
    title: doc.title,
    business_info: doc.businessInfo as any,
    client_info: doc.clientInfo as any,
    items: doc.items as any,
    tax_rate: doc.taxRate,
    cost_items: (doc.costItems ?? []) as any,
    terms_and_conditions: doc.termsAndConditions,
    issue_date: doc.issueDate ?? null,
    due_date: doc.dueDate ?? null,
    created_at: doc.createdAt,
  };
}

function fromDbRow(row: any): QuoteDocument {
  return {
    id: row.id,
    type: row.type,
    quoteNumber: row.quote_number,
    invoiceNumber: row.invoice_number ?? undefined,
    receiptNumber: row.receipt_number ?? undefined,
    title: row.title,
    businessInfo: row.business_info,
    clientInfo: row.client_info,
    items: row.items,
    taxRate: Number(row.tax_rate),
    costItems: Array.isArray(row.cost_items) ? row.cost_items : [],
    termsAndConditions: row.terms_and_conditions,
    issueDate: row.issue_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
  };
}

async function syncReceiptToMoneyTracker(doc: QuoteDocument, userId: string) {
  if (doc.type !== 'receipt') return;

  const amount = calculateCostTotal(doc.costItems);
  const { data: existing } = await supabase
    .from('money_entries')
    .select('id')
    .eq('document_id', doc.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('money_entries').update({
      client_name: doc.clientInfo.name,
      items: doc.items as any,
      cost_items: (doc.costItems ?? []) as any,
      amount,
      receipt_number: doc.receiptNumber ?? null,
    }).eq('id', existing.id);
    return;
  }

  // Load or create allocation settings
  let { data: settings } = await supabase
    .from('allocation_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!settings) {
    const { data: created } = await supabase
      .from('allocation_settings')
      .insert({ user_id: userId })
      .select()
      .single();
    settings = created;
  }

  const { data: entry, error: entryErr } = await supabase.from('money_entries').insert({
    user_id: userId,
    document_id: doc.id,
    receipt_number: doc.receiptNumber ?? null,
    client_name: doc.clientInfo.name,
    items: doc.items as any,
    cost_items: (doc.costItems ?? []) as any,
    amount,
    entry_date: (doc.issueDate ?? doc.createdAt).slice(0, 10),
  }).select().single();

  if (entryErr || !entry || !settings) return;

  const buckets: Array<{ bucket: string; pct: number }> = [
    { bucket: 'expenses', pct: Number(settings.expenses_pct) },
    { bucket: 'reserve',  pct: Number(settings.reserve_pct) },
    { bucket: 'taxes',    pct: Number(settings.taxes_pct) },
    { bucket: 'debts',    pct: Number(settings.debts_pct) },
  ];

  await supabase.from('allocations').insert(
    buckets.map(b => ({
      user_id: userId,
      money_entry_id: entry.id,
      bucket: b.bucket,
      amount: Math.round(amount * b.pct) / 100,
      is_auto: true,
      note: `Auto-split ${b.pct}%`,
    }))
  );
}

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<QuoteDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial document list from Supabase
  const fetchDocs = async () => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
    } else {
      const docs = (data || []).map(fromDbRow);
      initCounters(docs);
      setDocuments(docs);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, [user]);

  // 🔴 Supabase Realtime Listener setup
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`public:documents:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newDoc = fromDbRow(payload.new);
            setDocuments(prev => {
              if (prev.some(d => d.id === newDoc.id)) return prev;
              const updated = [newDoc, ...prev];
              initCounters(updated);
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedDoc = fromDbRow(payload.new);
            setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setDocuments(prev => prev.filter(d => d.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Add Document with error safety & background sync
  const addDocument = async (doc: QuoteDocument): Promise<boolean> => {
    if (!user) return false;

    // Optimistic UI update
    setDocuments(prev => [doc, ...prev]);

    const { error } = await supabase.from('documents').insert(toDbRow(doc, user.id));

    if (error) {
      console.error('Error adding document:', error);
      // Revert optimistic update on failure
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      return false;
    }

    // Trigger downstream CRM & Money Tracker syncs asynchronously
    Promise.all([
      syncReceiptToMoneyTracker(doc, user.id),
      syncDealForDocument(doc, user.id),
    ]).catch(err => console.error('Error syncing document integrations:', err));

    return true;
  };

  // Update Document with error safety & background sync
  const updateDocument = async (doc: QuoteDocument): Promise<boolean> => {
    if (!user) return false;

    const previousDocs = [...documents];
    setDocuments(prev => prev.map(d => d.id === doc.id ? doc : d));

    const { error } = await supabase.from('documents').update(toDbRow(doc, user.id)).eq('id', doc.id);

    if (error) {
      console.error('Error updating document:', error);
      // Revert on error
      setDocuments(previousDocs);
      return false;
    }

    // Trigger downstream CRM & Money Tracker syncs
    Promise.all([
      syncReceiptToMoneyTracker(doc, user.id),
      syncDealForDocument(doc, user.id),
    ]).catch(err => console.error('Error syncing document integrations:', err));

    return true;
  };

  // Delete Document with error safety
  const deleteDocument = async (id: string): Promise<boolean> => {
    if (!user) return false;

    const previousDocs = [...documents];
    setDocuments(prev => prev.filter(d => d.id !== id));

    const { error } = await supabase.from('documents').delete().eq('id', id);

    if (error) {
      console.error('Error deleting document:', error);
      // Revert on error
      setDocuments(previousDocs);
      return false;
    }

    return true;
  };

  return (
    <DocumentContext.Provider
      value={{
        documents,
        loading,
        addDocument,
        updateDocument,
        deleteDocument,
        refreshDocuments: fetchDocs,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocuments() {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentProvider');
  return ctx;
}