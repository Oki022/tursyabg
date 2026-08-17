CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rows_processed integer NOT NULL DEFAULT 0,
  error text
);
GRANT SELECT ON public.cron_runs TO authenticated;
GRANT ALL ON public.cron_runs TO service_role;
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cron_runs_staff_read" ON public.cron_runs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS cron_runs_job_started_idx ON public.cron_runs (job_name, started_at DESC);

-- ---------- idempotent, batched sweeps ----------
DROP FUNCTION IF EXISTS public.sweep_expiry_notifications();
CREATE FUNCTION public.sweep_expiry_notifications(_batch integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _n integer := 0; _c integer;
BEGIN
  WITH c AS (
    SELECT t.id, t.user_id, t.title FROM public.tasks t
    WHERE t.status = 'active' AND t.created_at < now() - interval '3 days'
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.task_id = t.id AND n.type = 'task_still_open')
    ORDER BY t.created_at LIMIT _batch
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
    SELECT c.user_id, 'task_still_open', 'Още ли търсиш изпълнител?',
      'Ако вече си възложил „' || c.title || '“, затвори задачата — така специалистите няма да харчат кредити напразно.',
      '/task/' || c.id::text, c.id FROM c RETURNING 1
  ) SELECT count(*) INTO _c FROM ins; _n := _n + _c;

  WITH c AS (
    SELECT t.id, t.user_id, t.title FROM public.tasks t
    WHERE t.status = 'active' AND t.created_at < now() - interval '14 days' AND t.freshness_prompt_at IS NULL
    ORDER BY t.created_at LIMIT _batch FOR UPDATE
  ), upd AS (
    UPDATE public.tasks t SET freshness_prompt_at = now() FROM c WHERE t.id = c.id RETURNING t.id
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
    SELECT c.user_id, 'task_freshness', 'Задачата ти още ли е актуална?',
      'Потвърди, че „' || c.title || '“ е активна. Без потвърждение я деактивираме след 7 дни.',
      '/task/' || c.id::text, c.id FROM c JOIN upd ON upd.id = c.id RETURNING 1
  ) SELECT count(*) INTO _c FROM ins; _n := _n + _c;

  WITH c AS (
    SELECT id FROM public.tasks
    WHERE status = 'active' AND freshness_prompt_at IS NOT NULL
      AND freshness_prompt_at < now() - interval '7 days'
    ORDER BY freshness_prompt_at LIMIT _batch
  ), upd AS (
    UPDATE public.tasks t SET status = 'inactive' FROM c WHERE t.id = c.id RETURNING 1
  ) SELECT count(*) INTO _c FROM upd; _n := _n + _c;

  WITH c AS (
    SELECT t.id, t.user_id, t.title FROM public.tasks t
    WHERE t.status = 'active' AND t.expires_at BETWEEN now() AND now() + interval '3 days'
      AND NOT EXISTS (SELECT 1 FROM public.notifications n
        WHERE n.task_id = t.id AND n.type = 'task_expiring' AND n.created_at > now() - interval '3 days')
    ORDER BY t.expires_at LIMIT _batch
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
    SELECT c.user_id, 'task_expiring', 'Задачата ти изтича скоро',
      'Задачата „' || c.title || '“ изтича след по-малко от 3 дни.', '/task/' || c.id::text, c.id
    FROM c RETURNING 1
  ) SELECT count(*) INTO _c FROM ins; _n := _n + _c;

  WITH c AS (
    SELECT t.id, t.user_id, t.title FROM public.tasks t
    WHERE t.expires_at < now()
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.task_id = t.id AND n.type = 'task_expired')
    ORDER BY t.expires_at LIMIT _batch
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
    SELECT c.user_id, 'task_expired', 'Задачата ти изтече',
      'Задачата „' || c.title || '“ вече не е активна.', '/task/' || c.id::text, c.id
    FROM c RETURNING 1
  ) SELECT count(*) INTO _c FROM ins; _n := _n + _c;

  WITH c AS (
    SELECT id FROM public.tasks WHERE status = 'active' AND expires_at < now()
    ORDER BY expires_at LIMIT _batch
  ), upd AS (
    UPDATE public.tasks t SET status = 'inactive' FROM c WHERE t.id = c.id RETURNING 1
  ) SELECT count(*) INTO _c FROM upd; _n := _n + _c;

  WITH c AS (
    SELECT p.user_id, p.task_id FROM public.task_promotions p
    WHERE p.expires_at BETWEEN now() AND now() + interval '1 day'
      AND NOT EXISTS (SELECT 1 FROM public.notifications n
        WHERE n.task_id = p.task_id AND n.type = 'promo_expiring' AND n.created_at > now() - interval '1 day')
    ORDER BY p.expires_at LIMIT _batch
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
    SELECT c.user_id, 'promo_expiring', 'Промоцията ти изтича утре',
      'Промоцията по задачата ти изтича след по-малко от 24 часа.', '/task/' || c.task_id::text, c.task_id
    FROM c RETURNING 1
  ) SELECT count(*) INTO _c FROM ins; _n := _n + _c;

  RETURN _n;
END; $function$;

DROP FUNCTION IF EXISTS public.sweep_engagements();
CREATE FUNCTION public.sweep_engagements(_batch integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _n integer := 0; _c integer; e record;
BEGIN
  FOR e IN SELECT * FROM public.engagements
    WHERE status = 'claimed' AND reminded_at IS NULL AND claimed_at < now() - interval '3 days'
    ORDER BY claimed_at LIMIT _batch
  LOOP
    UPDATE public.engagements SET reminded_at = now() WHERE id = e.id AND reminded_at IS NULL;
    IF FOUND THEN
      PERFORM public.push_notification(e.client_id, 'engagement_reminder', 'Потвърди изпълнителя си',
        'Все още чакаме потвърждение за изпълнителя по задачата ти.', '/task/' || e.task_id::text, e.task_id);
      _n := _n + 1;
    END IF;
  END LOOP;

  WITH c AS (
    SELECT id FROM public.engagements
    WHERE status = 'claimed' AND claimed_at < now() - interval '7 days'
    ORDER BY claimed_at LIMIT _batch
  ), upd AS (
    UPDATE public.engagements en SET status = 'expired' FROM c WHERE en.id = c.id RETURNING 1
  ) SELECT count(*) INTO _c FROM upd; _n := _n + _c;

  FOR e IN SELECT * FROM public.engagements
    WHERE status = 'confirmed' AND review_deadline > now() AND confirmed_at < now() - interval '3 days'
    ORDER BY confirmed_at LIMIT _batch
  LOOP
    PERFORM public.push_notification(u.uid, 'review_reminder', 'Остави отзив',
      'Имаш още време да оставиш отзив за съвместната работа.', '/review/' || e.id::text, e.task_id)
    FROM (SELECT e.client_id AS uid UNION ALL SELECT e.professional_id) u
    WHERE NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.engagement_id = e.id AND r.reviewer_id = u.uid)
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = u.uid AND n.type = 'review_reminder'
        AND n.task_id = e.task_id AND n.created_at > now() - interval '6 days');
    _n := _n + 1;
  END LOOP;

  FOR e IN SELECT * FROM public.engagements
    WHERE status = 'confirmed' AND review_deadline <= now()
      AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.engagement_id = e.id AND r.is_visible = false)
    ORDER BY review_deadline LIMIT _batch
  LOOP
    PERFORM public.reveal_engagement_reviews(e.id);
    _n := _n + 1;
  END LOOP;

  RETURN _n;
END; $function$;

-- ---------- logged runner ----------
CREATE OR REPLACE FUNCTION public.run_cron_job(_job_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _run uuid; _rows integer := 0;
BEGIN
  INSERT INTO public.cron_runs (job_name) VALUES (_job_name) RETURNING id INTO _run;
  BEGIN
    IF _job_name = 'sweep_expiry_notifications' THEN
      _rows := public.sweep_expiry_notifications(500);
    ELSIF _job_name = 'sweep_engagements' THEN
      _rows := public.sweep_engagements(500);
    ELSE
      RAISE EXCEPTION 'UNKNOWN_JOB %', _job_name;
    END IF;
    UPDATE public.cron_runs SET finished_at = now(), rows_processed = _rows WHERE id = _run;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.cron_runs SET finished_at = now(), error = SQLERRM WHERE id = _run;
  END;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_cron_health()
RETURNS TABLE(job_name text, last_success timestamptz, last_run timestamptz, last_error text, rows_processed integer, stale boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT j.name,
    (SELECT max(r.started_at) FROM public.cron_runs r WHERE r.job_name = j.name AND r.error IS NULL AND r.finished_at IS NOT NULL),
    (SELECT max(r.started_at) FROM public.cron_runs r WHERE r.job_name = j.name),
    (SELECT r.error FROM public.cron_runs r WHERE r.job_name = j.name ORDER BY r.started_at DESC LIMIT 1),
    (SELECT r.rows_processed FROM public.cron_runs r WHERE r.job_name = j.name ORDER BY r.started_at DESC LIMIT 1),
    COALESCE((SELECT max(r.started_at) FROM public.cron_runs r WHERE r.job_name = j.name AND r.error IS NULL AND r.finished_at IS NOT NULL), '-infinity'::timestamptz) < now() - interval '2 hours'
  FROM (VALUES ('sweep_expiry_notifications'), ('sweep_engagements')) AS j(name);
END; $function$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('sweep-expiry-hourly','sweep-engagements-hourly');
SELECT cron.schedule('sweep-expiry-hourly', '0 * * * *', $$SELECT public.run_cron_job('sweep_expiry_notifications')$$);
SELECT cron.schedule('sweep-engagements-hourly', '30 * * * *', $$SELECT public.run_cron_job('sweep_engagements')$$);

-- ---------- delete-task overload cleanup ----------
DROP FUNCTION IF EXISTS public.admin_delete_task(uuid, text);
DROP FUNCTION IF EXISTS public.admin_delete_task(uuid, text, boolean);
CREATE FUNCTION public.admin_delete_task(_task_id uuid, _reason text, _fraudulent boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _refunded int := 0; _credits int := 0; _row record; _balance int; _title text;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF _fraudulent IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FRAUD_FLAG_REQUIRED');
  END IF;

  SELECT title INTO _title FROM public.tasks WHERE id = _task_id;

  IF _fraudulent THEN
    FOR _row IN SELECT id, user_id, credits_spent FROM public.task_unlocks WHERE task_id = _task_id LOOP
      UPDATE public.profiles SET credits = credits + _row.credits_spent
        WHERE id = _row.user_id RETURNING credits INTO _balance;
      INSERT INTO public.credit_transactions (user_id, amount, type, balance_after, description)
      VALUES (_row.user_id, _row.credits_spent, 'refund', _balance,
        'Автоматично възстановяване — задачата е премахната като измамна');
      PERFORM public.push_notification(_row.user_id, 'refund_auto_approved',
        'Кредитите ти са върнати автоматично',
        'Задачата „' || COALESCE(_title, 'Задача') || '“ беше премахната като измамна. Върнати са ти '
          || _row.credits_spent || ' кредита.', '/settings/billing', NULL);
      _refunded := _refunded + 1;
      _credits := _credits + _row.credits_spent;
    END LOOP;
  END IF;

  PERFORM public.log_admin_action('task_deleted', 'task', _task_id,
    jsonb_build_object('reason', COALESCE(_reason, ''), 'fraudulent', _fraudulent,
      'refunded_users', _refunded, 'refunded_credits', _credits));
  DELETE FROM public.tasks WHERE id = _task_id;
  RETURN jsonb_build_object('ok', true, 'refunded_users', _refunded, 'refunded_credits', _credits);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_task_delete_preview(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _users int; _credits int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT count(*), COALESCE(sum(credits_spent), 0) INTO _users, _credits
    FROM public.task_unlocks WHERE task_id = _task_id;
  RETURN jsonb_build_object('unlockers', _users, 'credits', _credits);
END; $function$;