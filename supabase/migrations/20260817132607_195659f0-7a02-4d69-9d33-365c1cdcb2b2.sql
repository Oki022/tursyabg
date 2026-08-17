REVOKE EXECUTE ON FUNCTION public.complete_payment(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_payment(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_payment(text, text) TO service_role;