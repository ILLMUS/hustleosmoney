DROP FUNCTION IF EXISTS public.seed_chart_of_accounts(uuid);

CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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

REVOKE ALL ON FUNCTION public.seed_chart_of_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_chart_of_accounts() TO authenticated;