REVOKE EXECUTE ON FUNCTION public.next_voucher_number(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.next_voucher_number(text) TO authenticated;