-- Phone availability is now checked on the server (guardAuthAttempt, behind
-- the auth rate limit). Anonymous and signed-in clients may no longer call it
-- directly, otherwise anyone could probe which phone numbers are registered.
revoke execute on function public.is_phone_available(text) from anon, authenticated;
grant execute on function public.is_phone_available(text) to service_role;