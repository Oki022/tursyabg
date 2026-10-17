-- Phone verification (src/lib/phone-verification.functions.ts) calls these two
-- functions with the service role from the server, but only postgres could
-- execute them, so "Изпрати код" and "Потвърди" always ended in SERVER_ERROR.
-- Give execute to service_role only; users must not call them directly, the
-- server function checks who is logged in and which phone is in the profile.
revoke all on function public.start_phone_verification(uuid, text, text) from public, anon, authenticated;
revoke all on function public.confirm_phone_verification(uuid, text) from public, anon, authenticated;
grant execute on function public.start_phone_verification(uuid, text, text) to service_role;
grant execute on function public.confirm_phone_verification(uuid, text) to service_role;
