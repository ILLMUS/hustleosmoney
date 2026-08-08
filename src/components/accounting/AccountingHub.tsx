import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useDocuments } from '@/context/DocumentContext';
import {
  Account, AccountType, DraftLine, JournalEntry, JournalLine, VatSettings, VoucherType,
  accountTotals, createJournalEntry, ensureChartOfAccounts, loadAccounting, postReceipts, uniqueCostCenters,
} from '@/lib/accounting';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RefreshCw } from 'lucide-react';
import { ChartOfAccounts } from './ChartOfAccounts';
import { JournalView } from './JournalView';
import { Reconciliation } from './Reconciliation';
import { Reports } from './Reports';
import { AuditTrail } from './AuditTrail';
import { BankImport } from './BankImport';
import { VoucherBooks } from './VoucherBooks';

export function AccountingHub() {
  const { user } = useAuth();
  const { documents } = useDocuments();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [vat, setVat] = useState<VatSettings & { id?: string }>({ vat_registered: false, vat_rate: 15, accounting_basis: 'cash' });
  const [loading, setLoading] = useState(true);
  const [auditKey, setAuditKey] = useState(0);
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const refresh = async (uid: string) => {
    const data = await loadAccounting(uid);
    setAccounts(data.accounts);
    setEntries(data.entries);
    setLines(data.lines);
    setAuditKey(k => k + 1);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      await ensureChartOfAccounts(user.id);
      const { data: s } = await supabase.from('allocation_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (s) {
        setVat({
          id: s.id,
          vat_registered: Boolean((s as any).vat_registered),
          vat_rate: Number((s as any).vat_rate ?? 15),
          accounting_basis: (s as any).accounting_basis ?? 'cash',
        });
      }
      await refresh(user.id);
      setLoading(false);
    })();
  }, [user]);

  const postedIds = useMemo(
    () => new Set(entries.filter(e => e.source_type === 'receipt' && e.source_id).map(e => e.source_id as string)),
    [entries],
  );

  const totalsAllTime = useMemo(() => accountTotals(accounts, lines, entries), [accounts, lines, entries]);


  const importReceipts = async () => {
    if (!user) return;
    try {
      const count = await postReceipts(user.id, documents, accounts, vat, postedIds);
      await refresh(user.id);
      toast.success(count ? `Posted ${count} receipt${count > 1 ? 's' : ''} to the ledger` : 'All receipts already posted');
    } catch {
      toast.error('Could not post receipts');
    }
  };

  const saveVat = async () => {
    if (!user) return;
    const payload: any = {
      user_id: user.id,
      vat_registered: vat.vat_registered,
      vat_rate: vat.vat_rate,
      accounting_basis: vat.accounting_basis,
    };
    const { error } = vat.id
      ? await supabase.from('allocation_settings').update(payload).eq('id', vat.id)
      : await supabase.from('allocation_settings').insert(payload);
    if (error) toast.error('Could not save VAT settings');
    else toast.success('VAT settings saved');
  };

  const addAccount = async (a: { code: string; name: string; type: AccountType; vat_rate: number }) => {
    if (!user) return;
    const { error } = await supabase.from('accounts').insert({ ...a, user_id: user.id });
    if (error) { toast.error('Could not add account'); return; }
    await refresh(user.id);
    toast.success('Account added');
  };

  const addEntry = async (
    header: {
      entry_date: string; memo: string; reference: string; contact_name: string;
      voucher_type?: VoucherType; cost_center?: string;
    },
    draft: DraftLine[],
  ) => {
    if (!user) return;
    try {
      await createJournalEntry(user.id, header, draft);
      await refresh(user.id);
      toast.success('Entry posted');
    } catch {
      toast.error('Could not post entry');
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!user) return;
    const { error } = await supabase.from('journal_entries').delete().eq('id', entryId);
    if (error) { toast.error('Could not delete entry'); return; }
    await refresh(user.id);
  };

  const toggleReconciled = async (entryId: string, reconciled: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from('journal_entries')
      .update({ is_reconciled: reconciled, reconciled_at: reconciled ? new Date().toISOString() : null })
      .eq('id', entryId);
    if (error) { toast.error('Could not update'); return; }
    setEntries(prev => prev.map(e => (e.id === entryId ? { ...e, is_reconciled: reconciled } : e)));
    setAuditKey(k => k + 1);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading books…</p>;

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-4 justify-between">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={vat.vat_registered}
              onCheckedChange={v => setVat(s => ({ ...s, vat_registered: v }))}
              id="vat-registered"
            />
            <Label htmlFor="vat-registered" className="text-xs">VAT registered</Label>
          </div>
          <div className="w-24">
            <Label className="text-xs">VAT rate %</Label>
            <Input type="number" value={vat.vat_rate} onChange={e => setVat(s => ({ ...s, vat_rate: Number(e.target.value) }))} />
          </div>
          <Button size="sm" variant="outline" onClick={saveVat}>Save</Button>
        </div>
        <Button size="sm" className="gap-1.5" onClick={importReceipts}>
          <RefreshCw className="h-3.5 w-3.5" /> Post receipts to ledger
        </Button>
      </Card>

      <Tabs defaultValue="journal">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="vouchers">Voucher books</TabsTrigger>
          <TabsTrigger value="accounts">Chart of accounts</TabsTrigger>
          <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
          <TabsTrigger value="bank">Bank import</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>
        <TabsContent value="journal" className="mt-4">
          <JournalView
            accounts={accounts}
            entries={entries}
            lines={lines}
            vatRate={vat.vat_rate}
            vatRegistered={vat.vat_registered}
            onCreate={addEntry}
            onDelete={deleteEntry}
          />
        </TabsContent>
        <TabsContent value="vouchers" className="mt-4">
          <VoucherBooks
            accounts={accounts}
            entries={entries}
            lines={lines}
            costCenters={uniqueCostCenters(entries)}
            onCreate={addEntry}
            onDelete={deleteEntry}
          />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <ChartOfAccounts totals={totalsAllTime} onCreate={addAccount} />
        </TabsContent>
        <TabsContent value="reconcile" className="mt-4">
          <Reconciliation accounts={accounts} entries={entries} lines={lines} onToggle={toggleReconciled} />
        </TabsContent>
        <TabsContent value="bank" className="mt-4">
          <BankImport
            accounts={accounts}
            entries={entries}
            lines={lines}
            onCreate={addEntry}
            onToggleReconciled={toggleReconciled}
          />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <Reports
            accounts={accounts}
            entries={entries}
            lines={lines}
            from={from}
            to={to}
            onRangeChange={(f, t) => { setFrom(f); setTo(t); }}
            vatRegistered={vat.vat_registered}
          />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          {user && (
            <AuditTrail
              userId={user.id}
              actorName={(user.user_metadata as any)?.full_name || user.email || 'You'}
              refreshKey={auditKey}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}