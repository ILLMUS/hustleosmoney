CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  entry_id uuid,
  action text NOT NULL,
  summary text NOT NULL DEFAULT '',
  amount_before numeric,
  amount_after numeric,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own audit select" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX audit_logs_user_created_idx ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_entry_idx ON public.audit_logs (entry_id);

CREATE OR REPLACE FUNCTION public.log_journal_entry_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before numeric;
  _after numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, actor_id, entity_type, entity_id, entry_id, action, summary, details)
    VALUES (NEW.user_id, auth.uid(), 'journal_entry', NEW.id, NEW.id, 'created',
            COALESCE(NULLIF(NEW.memo, ''), 'Journal entry'),
            jsonb_build_object('entry_date', NEW.entry_date, 'reference', NEW.reference, 'source_type', NEW.source_type));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(debit), 0) INTO _before FROM public.journal_lines WHERE entry_id = OLD.id;
    INSERT INTO public.audit_logs (user_id, actor_id, entity_type, entity_id, entry_id, action, summary, amount_before, details)
    VALUES (OLD.user_id, auth.uid(), 'journal_entry', OLD.id, OLD.id, 'deleted',
            COALESCE(NULLIF(OLD.memo, ''), 'Journal entry'), _before,
            jsonb_build_object('entry_date', OLD.entry_date, 'reference', OLD.reference));
    RETURN OLD;
  ELSE
    IF OLD.is_reconciled IS DISTINCT FROM NEW.is_reconciled THEN
      SELECT COALESCE(SUM(debit - credit), 0) INTO _after
      FROM public.journal_lines jl
      JOIN public.accounts a ON a.id = jl.account_id
      WHERE jl.entry_id = NEW.id AND a.code = '1000';
      INSERT INTO public.audit_logs (user_id, actor_id, entity_type, entity_id, entry_id, action, summary, amount_after, details)
      VALUES (NEW.user_id, auth.uid(), 'reconciliation', NEW.id, NEW.id,
              CASE WHEN NEW.is_reconciled THEN 'reconciled' ELSE 'unreconciled' END,
              COALESCE(NULLIF(NEW.memo, ''), 'Bank line'), _after,
              jsonb_build_object('reconciled_at', NEW.reconciled_at));
    END IF;
    IF (OLD.memo, OLD.entry_date, OLD.reference, OLD.contact_name) IS DISTINCT FROM (NEW.memo, NEW.entry_date, NEW.reference, NEW.contact_name) THEN
      INSERT INTO public.audit_logs (user_id, actor_id, entity_type, entity_id, entry_id, action, summary, details)
      VALUES (NEW.user_id, auth.uid(), 'journal_entry', NEW.id, NEW.id, 'edited',
              COALESCE(NULLIF(NEW.memo, ''), 'Journal entry'),
              jsonb_build_object('before', jsonb_build_object('memo', OLD.memo, 'entry_date', OLD.entry_date, 'reference', OLD.reference, 'contact_name', OLD.contact_name),
                                 'after', jsonb_build_object('memo', NEW.memo, 'entry_date', NEW.entry_date, 'reference', NEW.reference, 'contact_name', NEW.contact_name)));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_journal_line_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, actor_id, entity_type, entity_id, entry_id, action, summary, amount_after, details)
    VALUES (NEW.user_id, auth.uid(), 'journal_line', NEW.id, NEW.entry_id, 'created',
            COALESCE(NULLIF(NEW.description, ''), 'Line'), GREATEST(NEW.debit, NEW.credit),
            jsonb_build_object('debit', NEW.debit, 'credit', NEW.credit, 'account_id', NEW.account_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, actor_id, entity_type, entity_id, entry_id, action, summary, amount_before, details)
    VALUES (OLD.user_id, auth.uid(), 'journal_line', OLD.id, OLD.entry_id, 'deleted',
            COALESCE(NULLIF(OLD.description, ''), 'Line'), GREATEST(OLD.debit, OLD.credit),
            jsonb_build_object('debit', OLD.debit, 'credit', OLD.credit, 'account_id', OLD.account_id));
    RETURN OLD;
  ELSE
    IF (OLD.debit, OLD.credit, OLD.account_id, OLD.description, OLD.vat_amount)
       IS DISTINCT FROM (NEW.debit, NEW.credit, NEW.account_id, NEW.description, NEW.vat_amount) THEN
      INSERT INTO public.audit_logs (user_id, actor_id, entity_type, entity_id, entry_id, action, summary, amount_before, amount_after, details)
      VALUES (NEW.user_id, auth.uid(), 'journal_line', NEW.id, NEW.entry_id, 'edited',
              COALESCE(NULLIF(NEW.description, ''), 'Line'),
              GREATEST(OLD.debit, OLD.credit), GREATEST(NEW.debit, NEW.credit),
              jsonb_build_object('before', jsonb_build_object('debit', OLD.debit, 'credit', OLD.credit, 'account_id', OLD.account_id, 'vat_amount', OLD.vat_amount),
                                 'after', jsonb_build_object('debit', NEW.debit, 'credit', NEW.credit, 'account_id', NEW.account_id, 'vat_amount', NEW.vat_amount)));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER journal_entries_audit
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.log_journal_entry_audit();

CREATE TRIGGER journal_lines_audit
AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.log_journal_line_audit();