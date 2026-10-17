-- The unconfirmed-account reminder job (/api/public/cron/unconfirmed-reminders)
-- calls these two functions with the service role, but only postgres could
-- execute them, so every run since 14 Oct failed with "permission denied".
-- Give execute to service_role only; users must never call them.
revoke all on function public.unconfirmed_reminder_batch(integer) from public, anon, authenticated;
revoke all on function public.mark_unconfirmed_reminder(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.unconfirmed_reminder_batch(integer) to service_role;
grant execute on function public.mark_unconfirmed_reminder(uuid, text, integer) to service_role;
