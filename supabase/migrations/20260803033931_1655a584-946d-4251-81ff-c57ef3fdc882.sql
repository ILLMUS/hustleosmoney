-- ACCOUNTS
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  subtype text,
  vat_rate numeric NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts select" ON public.accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own accounts update" ON public.accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own accounts delete" ON public.accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- JOURNAL ENTRIES
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  memo text NOT NULL DEFAULT '',
  reference text,
  contact_name text,
  source_type text NOT NULL DEFAULT 'manual',
  source_id uuid,
  is_reconciled boolean NOT NULL DEFAULT false,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own je select" ON public.journal_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own je insert" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own je update" ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own je delete" ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- JOURNAL LINES
CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  description text NOT NULL DEFAULT '',
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jl select" ON public.journal_lines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own jl insert" ON public.journal_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own jl update" ON public.journal_lines FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own jl delete" ON public.journal_lines FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_journal_lines_entry ON public.journal_lines(entry_id);
CREATE INDEX idx_journal_entries_user_date ON public.journal_entries(user_id, entry_date DESC);

-- VAT SETTINGS
ALTER TABLE public.allocation_settings
  ADD COLUMN IF NOT EXISTS vat_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash';

-- updated_at triggers
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER journal_entries_updated_at BEFORE UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED CHART OF ACCOUNTS
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.accounts (user_id, code, name, type, subtype, is_system)
  VALUES
    (_user_id, '1000', 'Business Bank Account', 'asset', 'bank', true),
    (_user_id, '1100', 'Accounts Receivable', 'asset', 'receivable', true),
    (_user_id, '1200', 'Owner Reserve', 'asset', 'reserve', true),
    (_user_id, '2000', 'Accounts Payable', 'liability', 'payable', true),
    (_user_id, '2100', 'VAT on Sales (Output)', 'liability', 'vat_output', true),
    (_user_id, '2200', 'VAT on Purchases (Input)', 'asset', 'vat_input', true),
    (_user_id, '2300', 'Taxes Payable', 'liability', 'tax', true),
    (_user_id, '2400', 'Debt / Loans', 'liability', 'debt', true),
    (_user_id, '3000', 'Owner Equity', 'equity', 'equity', true),
    (_user_id, '4000', 'Sales Revenue', 'income', 'sales', true),
    (_user_id, '5000', 'Labour', 'expense', 'labour', true),
    (_user_id, '5100', 'Services', 'expense', 'services', true),
    (_user_id, '5200', 'Materials & Other Costs', 'expense', 'other', true),
    (_user_id, '5300', 'Margin Reserve', 'expense', 'margin', true),
    (_user_id, '6000', 'General Expenses', 'expense', 'expenses', true)
  ON CONFLICT (user_id, code) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.seed_chart_of_accounts(uuid) TO authenticated;