import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, FileText, User, DollarSign, Calculator } from 'lucide-react';
import { toast } from 'sonner';

export interface DocumentItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface DocumentCostItem {
  id: string;
  description: string;
  amount: number;
}

export interface DocumentFormData {
  id?: string;
  type: 'quote' | 'invoice' | 'receipt';
  quote_number: string;
  title: string;
  status: 'draft' | 'sent' | 'paid' | 'accepted' | 'declined';
  client_id: string | null;
  issue_date: string;
  due_date: string;
  tax_rate: number;
  items: DocumentItem[];
  cost_items: DocumentCostItem[];
  notes: string;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
}

interface DocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentToEdit?: DocumentFormData | null;
  onSuccess: () => void;
}

export default function DocumentModal({
  open,
  onOpenChange,
  documentToEdit,
  onSuccess,
}: DocumentModalProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [type, setType] = useState<'quote' | 'invoice' | 'receipt'>('quote');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'draft' | 'sent' | 'paid' | 'accepted' | 'declined'>('draft');
  const [clientId, setClientId] = useState<string>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DocumentItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 },
  ]);
  const [costItems, setCostItems] = useState<DocumentCostItem[]>([]);

  // Load user clients for dropdown
  useEffect(() => {
    if (!user || !open) return;
    const fetchClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, email, company')
        .eq('user_id', user.id)
        .order('name');
      setClients(data || []);
    };
    fetchClients();
  }, [user, open]);

  // Sync state when editing or resetting
  useEffect(() => {
    if (documentToEdit) {
      setType(documentToEdit.type);
      setQuoteNumber(documentToEdit.quote_number);
      setTitle(documentToEdit.title || '');
      setStatus(documentToEdit.status);
      setClientId(documentToEdit.client_id || '');
      setIssueDate(documentToEdit.issue_date || new Date().toISOString().split('T')[0]);
      setDueDate(documentToEdit.due_date || '');
      setTaxRate(documentToEdit.tax_rate || 0);
      setNotes(documentToEdit.notes || '');
      setItems(documentToEdit.items.length > 0 ? documentToEdit.items : [
        { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 }
      ]);
      setCostItems(documentToEdit.cost_items || []);
    } else {
      resetForm();
    }
  }, [documentToEdit, open]);

  const resetForm = () => {
    setType('quote');
    setQuoteNumber(`DOC-${Math.floor(1000 + Math.random() * 9000)}`);
    setTitle('');
    setStatus('draft');
    setClientId('');
    setIssueDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setTaxRate(0);
    setNotes('');
    setItems([{ id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 }]);
    setCostItems([]);
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;
  const totalCost = costItems.reduce((sum, cost) => sum + cost.amount, 0);
  const estimatedProfit = grandTotal - totalCost;

  // Item Management Logic
  const handleAddItem = () => {
    setItems(prev => [...prev, { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return toast.error('Document must contain at least one line item');
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof DocumentItem, value: string | number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Cost Management Logic
  const handleAddCost = () => {
    setCostItems(prev => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }]);
  };

  const handleRemoveCost = (id: string) => {
    setCostItems(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateCost = (id: string, field: keyof DocumentCostItem, value: string | number) => {
    setCostItems(prev => prev.map(cost => cost.id === id ? { ...cost, [field]: value } : cost));
  };

  // Validation & Save Handler
  const handleSubmit = async () => {
    if (!user) return;
    if (!quoteNumber.trim()) return toast.error('Document number is required');
    if (items.some(i => !i.description.trim())) return toast.error('All line items require a description');

    setLoading(true);
    const payload = {
      user_id: user.id,
      type,
      quote_number: quoteNumber.trim(),
      title: title.trim() || `${type.toUpperCase()} #${quoteNumber}`,
      status,
      client_id: clientId || null,
      issue_date: issueDate || null,
      due_date: dueDate || null,
      tax_rate: Number(taxRate) || 0,
      items,
      cost_items: costItems,
      notes: notes.trim(),
      updated_at: new Date().toISOString(),
    };

    let result;
    if (documentToEdit?.id) {
      result = await supabase.from('documents').update(payload).eq('id', documentToEdit.id);
    } else {
      result = await supabase.from('documents').insert(payload);
    }

    setLoading(false);

    if (result.error) {
      toast.error(`Failed to save document: ${result.error.message}`);
    } else {
      toast.success(`Document ${documentToEdit?.id ? 'updated' : 'created'} successfully`);
      onSuccess();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {documentToEdit ? 'Edit Document' : 'Create New Document'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label>Document Type</Label>
              <Select value={type} onValueChange={(v: 'quote' | 'invoice' | 'receipt') => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Document # *</Label>
              <Input value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} placeholder="e.g. INV-1001" />
            </div>

            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Title / Project Name</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Website Redesign" />
            </div>

            <div className="grid gap-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label>Issue Date</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Tax Rate (%)</Label>
              <Input type="number" min="0" step="0.1" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <Separator />

          {/* Line Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-semibold text-sm flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-primary" /> Line Items
              </h4>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder={`Item ${index + 1} description`}
                  value={item.description}
                  onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                />
                <Input
                  type="number"
                  className="w-20"
                  min="1"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={e => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                />
                <Input
                  type="number"
                  className="w-28"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={item.unit_price}
                  onChange={e => handleUpdateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                />
                <div className="w-24 text-right font-mono text-sm font-semibold">
                  E{(item.quantity * item.unit_price).toFixed(2)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Optional Direct Expenses / Costs */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-heading font-semibold text-sm flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-primary" /> Direct Project Costs (Optional)
                </h4>
                <p className="text-[11px] text-muted-foreground">Track expenses linked to this document to calculate net profit</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddCost} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Expense
              </Button>
            </div>

            {costItems.map((cost) => (
              <div key={cost.id} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Expense description (e.g., Subcontractor, Software, Hardware)"
                  value={cost.description}
                  onChange={e => handleUpdateCost(cost.id, 'description', e.target.value)}
                />
                <Input
                  type="number"
                  className="w-28"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={cost.amount}
                  onChange={e => handleUpdateCost(cost.id, 'amount', parseFloat(e.target.value) || 0)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveCost(cost.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Calculations Summary Card */}
          <Card className="bg-muted/40">
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">E{subtotal.toFixed(2)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({taxRate}%)</span>
                  <span className="font-mono">E{taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-primary border-t pt-2">
                <span>Grand Total</span>
                <span className="font-mono">E{grandTotal.toFixed(2)}</span>
              </div>
              {costItems.length > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground border-t pt-1">
                  <span>Est. Expenses: E{totalCost.toFixed(2)}</span>
                  <span className={estimatedProfit >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                    Est. Profit: E{estimatedProfit.toFixed(2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-1.5">
            <Label>Notes & Payment Instructions</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Bank details, payment due terms, or quote expiration..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : documentToEdit ? 'Update Document' : 'Create Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}