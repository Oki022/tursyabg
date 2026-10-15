-- Cron watchdog: /api/public/monitoring/cron-check now needs a secret key and
-- is called hourly by pg_cron, so failed scheduled jobs (cron_runs.error)
-- actually reach Sentry. Before this nothing called it.

insert into public.cron_secrets (name, token)
select 'cron_check', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.cron_secrets where name = 'cron_check');

create or replace function public.call_cron_check()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _token text;
begin
  select token into _token from public.cron_secrets where name = 'cron_check';
  perform net.http_post(
    url := 'https://tursya.bg/api/public/monitoring/cron-check',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', _token),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.call_cron_check() from public, anon, authenticated;

-- Every hour at :50; the endpoint looks at the previous 60 minutes.
select cron.schedule('cron-check-hourly', '50 * * * *', 'SELECT public.call_cron_check()');

notify pgrst, 'reload schema';
