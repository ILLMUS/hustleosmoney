REVOKE EXECUTE ON FUNCTION public.log_journal_entry_audit() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_journal_line_audit() FROM public, anon, authenticated;