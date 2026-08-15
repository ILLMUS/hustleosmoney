// lib/integration/serializer.ts
import { CanonicalQuote, CreateQuoteInput, ExternalReference } from '@/types/integration';

export class CanonicalSerializer {
  /**
   * Serializes raw internal DB records into the Canonical External Quote format
   */
  static toCanonical(doc: any, extRef?: any): CanonicalQuote {
    const clientInfo = doc.client_info || {};
    const items = Array.isArray(doc.items) ? doc.items : [];

    // Calculate subtotal and tax totals dynamically from internal schema
    const subtotal = items.reduce((acc: number, item: any) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unit_price || item.price) || 0;
      const discount = Number(item.discount) || 0;
      return acc + (qty * price - discount);
    }, 0);

    const taxRate = Number(doc.tax_rate) || 0;
    const taxTotal = subtotal * (taxRate / 100);
    const grandTotal = subtotal + taxTotal;

    return {
      id: doc.id,
      quote_number: doc.quote_number || doc.title || 'DRAFT',
      status: (doc.status as any) || 'draft',
      external_reference: extRef ? {
        system: extRef.external_system,
        record_type: extRef.external_record_type,
        record_id: extRef.external_record_id,
        metadata: extRef.metadata || {},
      } : null,
      customer: {
        id: doc.client_id || undefined,
        name: clientInfo.name || 'Unknown Client',
        email: clientInfo.email || '',
        phone: clientInfo.phone || '',
        company: clientInfo.company || '',
        address: clientInfo.address || '',
      },
      currency: doc.currency || 'USD',
      financials: {
        subtotal: Math.round(subtotal * 100) / 100,
        tax_rate: taxRate,
        tax_total: Math.round(taxTotal * 100) / 100,
        discount_total: 0,
        grand_total: Math.round(grandTotal * 100) / 100,
      },
      items: items.map((item: any, idx: number) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unit_price || item.price) || 0;
        const discount = Number(item.discount) || 0;
        return {
          id: item.id || `item-${idx + 1}`,
          description: item.description || item.title || '',
          quantity: qty,
          unit_price: price,
          discount: discount,
          tax_rate: taxRate,
          total: Math.round((qty * price - discount) * 100) / 100,
        };
      }),
      notes: doc.notes || '',
      terms: doc.terms_and_conditions || '',
      created_at: doc.created_at,
      updated_at: doc.updated_at || doc.created_at,
    };
  }

  /**
   * Deserializes incoming Canonical creation input into internal `documents` schema payload
   */
  static toInternalDocument(input: CreateQuoteInput, userId: string, generatedQuoteNumber: string) {
    const items = input.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount || 0,
      total: (item.quantity * item.unit_price) - (item.discount || 0),
    }));

    return {
      user_id: userId,
      type: 'quote',
      title: `Quote ${generatedQuoteNumber}`,
      quote_number: generatedQuoteNumber,
      status: 'draft',
      client_info: {
        name: input.customer.name,
        email: input.customer.email || '',
        phone: input.customer.phone || '',
        company: input.customer.company || '',
        address: input.customer.address || '',
      },
      items: items,
      tax_rate: input.tax_rate || 0,
      notes: input.notes || '',
      terms_and_conditions: input.terms || '',
      currency: input.currency || 'USD',
    };
  }
}