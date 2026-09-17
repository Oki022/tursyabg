CREATE TABLE public.cron_secrets (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cron_secrets TO service_role;
ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to cron secrets" ON public.cron_secrets
  FOR SELECT TO authenticated USING (false);

INSERT INTO public.cron_secrets(name) VALUES ('unconfirmed_reminders');

CREATE OR REPLACE FUNCTION public.call_unconfirmed_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _token text;
BEGIN
  SELECT token INTO _token FROM public.cron_secrets WHERE name = 'unconfirmed_reminders';
  PERFORM net.http_post(
    url := 'https://project--233975ab-1dd4-439f-8c51-431acbafe057.lovable.app/api/public/cron/unconfirmed-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', _token),
    body := '{}'::jsonb
  );
END; $$;
REVOKE ALL ON FUNCTION public.call_unconfirmed_reminders() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('unconfirmed-reminders-daily', '15 9 * * *',
  $$SELECT public.call_unconfirmed_reminders()$$);
