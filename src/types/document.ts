export type DocumentType = 'quote' | 'invoice' | 'receipt';

export interface BusinessInfo {
  logo: string | null;
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface ClientInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export type CostCategory = 'labour' | 'services' | 'margin' | 'other';

export const COST_CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: 'labour', label: 'Labour' },
  { value: 'services', label: 'Services' },
  { value: 'margin', label: 'Margin' },
  { value: 'other', label: 'Other' },
];

export interface CostItem {
  id: string;
  category: CostCategory;
  /** Custom label, used when category === 'other' */
  customLabel?: string;
  description: string;
  amount: number;
}

export function costItemLabel(item: CostItem): string {
  if (item.category === 'other') return item.customLabel?.trim() || 'Other';
  return COST_CATEGORIES.find(c => c.value === item.category)?.label ?? 'Other';
}

export function calculateCostTotal(costItems: CostItem[] | undefined): number {
  return (costItems ?? []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

export interface QuoteDocument {
  id: string;
  type: DocumentType;
  quoteNumber: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  title: string;
  businessInfo: BusinessInfo;
  clientInfo: ClientInfo;
  items: LineItem[];
  taxRate: number;
  termsAndConditions: string;
  /** Job cost breakdown (labour/services/margin/other) — money tracked in Money Tracker */
  costItems?: CostItem[];
  createdAt: string;
  issueDate?: string;
  dueDate?: string;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function calculateSubtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * (taxRate / 100);
}

export function calculateGrandTotal(items: LineItem[], taxRate: number): number {
  const subtotal = calculateSubtotal(items);
  return subtotal + calculateTax(subtotal, taxRate);
}

let quoteCounter = 0;
let invoiceCounter = 0;
let receiptCounter = 0;

export function initCounters(docs: QuoteDocument[]) {
  docs.forEach(d => {
    const qNum = parseInt(d.quoteNumber.replace('Q-', ''));
    if (qNum > quoteCounter) quoteCounter = qNum;
    if (d.invoiceNumber) {
      const iNum = parseInt(d.invoiceNumber.replace('INV-', ''));
      if (iNum > invoiceCounter) invoiceCounter = iNum;
    }
    if (d.receiptNumber) {
      const rNum = parseInt(d.receiptNumber.replace('REC-', ''));
      if (rNum > receiptCounter) receiptCounter = rNum;
    }
  });
}

export function nextQuoteNumber(): string {
  quoteCounter++;
  return `Q-${String(quoteCounter).padStart(4, '0')}`;
}

export function nextInvoiceNumber(): string {
  invoiceCounter++;
  return `INV-${String(invoiceCounter).padStart(4, '0')}`;
}

export function nextReceiptNumber(): string {
  receiptCounter++;
  return `REC-${String(receiptCounter).padStart(4, '0')}`;
}
