
-- Generic server-side rate limiting -----------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_hits_lookup_idx
  ON public.rate_limit_hits (bucket, subject, created_at DESC);

GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- no policies: only SECURITY DEFINER functions read/write this table

CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  _bucket text,
  _subject text,
  _limit int,
  _window interval
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n int;
BEGIN
  IF _subject IS NULL OR _subject = '' THEN
    RETURN;
  END IF;

  SELECT count(*) INTO _n
  FROM public.rate_limit_hits
  WHERE bucket = _bucket
    AND subject = _subject
    AND created_at > now() - _window;

  IF _n >= _limit THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  INSERT INTO public.rate_limit_hits (bucket, subject) VALUES (_bucket, _subject);

  -- opportunistic cleanup, ~1% of calls
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_hits WHERE created_at < now() - interval '2 days';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_rate_limit(text, text, int, interval) FROM public, anon, authenticated;

-- Per-user limits on user-generated content ---------------------------------
CREATE OR REPLACE FUNCTION public.rl_tasks_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.enforce_rate_limit('task_insert', auth.uid()::text, 10, interval '1 hour');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rl_tasks_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id THEN
    PERFORM public.enforce_rate_limit('task_update', auth.uid()::text, 40, interval '1 hour');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rl_messages_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.enforce_rate_limit('message_send', auth.uid()::text, 60, interval '1 hour');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rl_reviews_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.enforce_rate_limit('review_insert', auth.uid()::text, 10, interval '1 day');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rl_reports_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.enforce_rate_limit('report_insert', auth.uid()::text, 10, interval '1 day');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rl_unlocks_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.enforce_rate_limit('contact_unlock', auth.uid()::text, 30, interval '1 hour');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rl_task_images_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.enforce_rate_limit('image_upload', auth.uid()::text, 40, interval '1 hour');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.rl_tasks_insert(), public.rl_tasks_update(), public.rl_messages_insert(),
  public.rl_reviews_insert(), public.rl_reports_insert(), public.rl_unlocks_insert(),
  public.rl_task_images_insert() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS rl_tasks_insert_trg ON public.tasks;
CREATE TRIGGER rl_tasks_insert_trg BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.rl_tasks_insert();

DROP TRIGGER IF EXISTS rl_tasks_update_trg ON public.tasks;
CREATE TRIGGER rl_tasks_update_trg BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.rl_tasks_update();

DROP TRIGGER IF EXISTS rl_messages_insert_trg ON public.messages;
CREATE TRIGGER rl_messages_insert_trg BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.rl_messages_insert();

DROP TRIGGER IF EXISTS rl_reviews_insert_trg ON public.reviews;
CREATE TRIGGER rl_reviews_insert_trg BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.rl_reviews_insert();

DROP TRIGGER IF EXISTS rl_task_reports_insert_trg ON public.task_reports;
CREATE TRIGGER rl_task_reports_insert_trg BEFORE INSERT ON public.task_reports
  FOR EACH ROW EXECUTE FUNCTION public.rl_reports_insert();

DROP TRIGGER IF EXISTS rl_review_reports_insert_trg ON public.review_reports;
CREATE TRIGGER rl_review_reports_insert_trg BEFORE INSERT ON public.review_reports
  FOR EACH ROW EXECUTE FUNCTION public.rl_reports_insert();

DROP TRIGGER IF EXISTS rl_task_unlocks_insert_trg ON public.task_unlocks;
CREATE TRIGGER rl_task_unlocks_insert_trg BEFORE INSERT ON public.task_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.rl_unlocks_insert();

DROP TRIGGER IF EXISTS rl_task_images_insert_trg ON public.task_images;
CREATE TRIGGER rl_task_images_insert_trg BEFORE INSERT ON public.task_images
  FOR EACH ROW EXECUTE FUNCTION public.rl_task_images_insert();

-- Auth attempt limiting (per email and per IP), called from the server -------
CREATE OR REPLACE FUNCTION public.guard_auth_attempt(
  _action text,
  _email text,
  _ip text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email_limit int;
  _ip_limit int;
  _window interval := interval '1 hour';
  _key text := lower(coalesce(_email, ''));
BEGIN
  IF _action NOT IN ('signup', 'login', 'reset', 'magiclink', 'resend') THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  IF _action = 'login' THEN
    _email_limit := 15; _ip_limit := 40;
  ELSIF _action = 'signup' THEN
    _email_limit := 5; _ip_limit := 10;
  ELSE
    _email_limit := 5; _ip_limit := 15;
  END IF;

  IF _key <> '' THEN
    PERFORM public.enforce_rate_limit('auth_' || _action || '_email', _key, _email_limit, _window);
  END IF;
  IF _ip IS NOT NULL AND _ip <> '' THEN
    PERFORM public.enforce_rate_limit('auth_' || _action || '_ip', _ip, _ip_limit, _window);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_auth_attempt(text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_auth_attempt(text, text, text) TO service_role;
