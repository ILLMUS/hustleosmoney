// types/integration.ts

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

export interface ExternalReference {
  system: string;         // e.g. "rst_business_os"
  record_type: string;    // e.g. "opportunity"
  record_id: string;      // e.g. "OPP-1045"
  metadata?: Record<string, any>;
}

export interface CanonicalCustomer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
}

export interface CanonicalItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_rate?: number;
  total: number;
}

export interface CanonicalQuote {
  id: string;
  quote_number: string;
  status: QuoteStatus;
  external_reference?: ExternalReference | null;
  customer: CanonicalCustomer;
  currency: string;
  financials: {
    subtotal: number;
    tax_rate: number;
    tax_total: number;
    discount_total: number;
    grand_total: number;
  };
  items: CanonicalItem[];
  notes?: string;
  terms?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteInput {
  external_reference?: ExternalReference;
  customer: CanonicalCustomer;
  currency?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount?: number;
    tax_rate?: number;
  }>;
  tax_rate?: number;
  notes?: string;
  terms?: string;
}