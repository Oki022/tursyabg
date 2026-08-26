-- 1) Schema -------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status_before_deactivation public.task_status;

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'account_deletion_scheduled';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'account_deletion_cancelled';

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adr_own_read" ON public.account_deletion_requests;
CREATE POLICY "adr_own_read" ON public.account_deletion_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS adr_one_pending_per_user
  ON public.account_deletion_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS adr_due_idx ON public.account_deletion_requests (scheduled_for)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS adr_set_updated_at ON public.account_deletion_requests;
CREATE TRIGGER adr_set_updated_at BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Write blocks while deactivated -------------------------------------
CREATE OR REPLACE FUNCTION public.block_deactivated_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  _uid := CASE TG_TABLE_NAME WHEN 'messages' THEN NEW.sender_id ELSE NEW.user_id END;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.deactivated_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ACCOUNT_DEACTIVATED';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tasks_block_deactivated ON public.tasks;
CREATE TRIGGER tasks_block_deactivated BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.block_deactivated_author();

DROP TRIGGER IF EXISTS messages_block_deactivated ON public.messages;
CREATE TRIGGER messages_block_deactivated BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.block_deactivated_author();

-- 3) Deactivate / reactivate -------------------------------------------
CREATE OR REPLACE FUNCTION public.deactivate_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  UPDATE public.tasks
     SET status_before_deactivation = status,
         status = 'inactive'
   WHERE user_id = _uid
     AND deleted_at IS NULL
     AND status IN ('active', 'pending', 'pending_payment');

  PERFORM public.suppress_task_lifecycle_notifications(t.id)
    FROM public.tasks t WHERE t.user_id = _uid AND t.status_before_deactivation IS NOT NULL;

  UPDATE public.profiles SET deactivated_at = now() WHERE id = _uid AND deactivated_at IS NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.reactivate_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND anonymized_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ACCOUNT_ANONYMIZED';
  END IF;

  UPDATE public.tasks
     SET status = COALESCE(status_before_deactivation, status),
         status_before_deactivation = NULL
   WHERE user_id = _uid AND status_before_deactivation IS NOT NULL AND deleted_at IS NULL;

  UPDATE public.account_deletion_requests
     SET status = 'cancelled'
   WHERE user_id = _uid AND status = 'pending';

  UPDATE public.profiles SET deactivated_at = NULL WHERE id = _uid;
END; $$;

-- 4) Deletion requests -------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _when timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT scheduled_for INTO _when FROM public.account_deletion_requests
   WHERE user_id = _uid AND status = 'pending';
  IF _when IS NOT NULL THEN RETURN _when; END IF;

  _when := now() + interval '14 days';
  INSERT INTO public.account_deletion_requests (user_id, scheduled_for) VALUES (_uid, _when);

  PERFORM public.deactivate_own_account();

  PERFORM public.push_notification(
    _uid, 'account_deletion_scheduled',
    'Заявката за изтриване на профила е приета',
    'Профилът ти ще бъде изтрит окончателно на ' || to_char(_when, 'DD.MM.YYYY') ||
    '. До тогава можеш да откажеш изтриването, като влезеш в профила си.',
    '/settings/security', NULL);

  RETURN _when;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _found boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  UPDATE public.account_deletion_requests SET status = 'cancelled'
   WHERE user_id = _uid AND status = 'pending'
  RETURNING true INTO _found;

  IF NOT COALESCE(_found, false) THEN RAISE EXCEPTION 'NO_PENDING_DELETION'; END IF;

  PERFORM public.reactivate_own_account();

  PERFORM public.push_notification(
    _uid, 'account_deletion_cancelled',
    'Изтриването на профила е отказано',
    'Профилът ти е активен отново и задачите ти са върнати в предишното си състояние.',
    '/profile', NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.my_account_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'deactivated_at', (SELECT deactivated_at FROM public.profiles WHERE id = auth.uid()),
    'deletion', (SELECT jsonb_build_object('requested_at', requested_at, 'scheduled_for', scheduled_for)
                   FROM public.account_deletion_requests
                  WHERE user_id = auth.uid() AND status = 'pending' LIMIT 1)
  );
$$;

-- 5) Data export (portability) ----------------------------------------
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  RETURN jsonb_build_object(
    'exported_at', now(),
    'profile', (SELECT to_jsonb(p) - 'balance' FROM (
        SELECT id, full_name, avatar_url, city, neighborhood, credits, skill_categories, skill_tags,
               completed_jobs, rating_as_pro, review_count_as_pro, rating_as_client,
               review_count_as_client, trust_level, created_at, deactivated_at
          FROM public.profiles WHERE id = _uid) p),
    'phone', (SELECT phone FROM public.profile_contacts WHERE user_id = _uid),
    'tasks', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
        SELECT id, title, description, category, budget, currency, city, neighborhood, status,
               view_count, unlock_count, created_at, updated_at, expires_at, deleted_at
          FROM public.tasks WHERE user_id = _uid ORDER BY created_at) t), '[]'::jsonb),
    'reviews_written', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT id, task_id, rating, comment, direction, created_at
          FROM public.reviews WHERE reviewer_id = _uid ORDER BY created_at) r), '[]'::jsonb),
    'reviews_received', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT id, task_id, rating, comment, direction, created_at
          FROM public.reviews WHERE reviewee_id = _uid AND is_visible ORDER BY created_at) r), '[]'::jsonb),
    'credit_transactions', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM (
        SELECT id, amount, type, task_id, balance_after, description, created_at
          FROM public.credit_transactions WHERE user_id = _uid ORDER BY created_at) c), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(to_jsonb(pay)) FROM (
        SELECT id, credits, amount_eur, currency, status, kind, created_at, completed_at, receipt_url
          FROM public.payments WHERE user_id = _uid ORDER BY created_at) pay), '[]'::jsonb),
    'unlocked_tasks', COALESCE((SELECT jsonb_agg(to_jsonb(u)) FROM (
        SELECT id, task_id, credits_spent, unlocked_at, expires_at
          FROM public.task_unlocks WHERE user_id = _uid ORDER BY unlocked_at) u), '[]'::jsonb)
  );
END; $$;

-- 6) Anonymisation + sweep --------------------------------------------
CREATE OR REPLACE FUNCTION public.anonymize_account(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Content that is purely the user's own goes away.
  DELETE FROM public.task_images i USING public.tasks t WHERE i.task_id = t.id AND t.user_id = _uid;
  DELETE FROM public.favourites WHERE user_id = _uid;
  DELETE FROM public.notifications WHERE user_id = _uid;
  DELETE FROM public.messages WHERE sender_id = _uid OR receiver_id = _uid;
  DELETE FROM public.profile_contacts WHERE user_id = _uid;

  -- Tasks are scrubbed and taken off the platform. Rows stay so that the
  -- counterparty's reviews and the financial audit trail remain valid.
  UPDATE public.tasks
     SET title = 'Изтрита задача',
         description = 'Съдържанието е премахнато по заявка за изтриване на профил.',
         city = NULL, neighborhood = NULL,
         status = 'inactive',
         status_before_deactivation = NULL,
         deleted_at = COALESCE(deleted_at, now()),
         deleted_reason = 'account_deleted'
   WHERE user_id = _uid;

  -- Identity becomes an anonymous placeholder; reviews and the credit
  -- ledger keep pointing at it.
  UPDATE public.profiles
     SET full_name = 'Изтрит потребител',
         avatar_url = NULL,
         city = NULL, neighborhood = NULL,
         skill_categories = ARRAY[]::text[],
         skill_tags = ARRAY[]::text[],
         deactivated_at = COALESCE(deactivated_at, now()),
         anonymized_at = now(),
         banned_at = COALESCE(banned_at, now()),
         ban_reason = 'Профилът е изтрит по заявка на потребителя.'
   WHERE id = _uid;
END; $$;

CREATE OR REPLACE FUNCTION public.sweep_account_deletions(_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record; _n integer := 0;
BEGIN
  FOR _r IN
    SELECT id, user_id FROM public.account_deletion_requests
     WHERE status = 'pending' AND scheduled_for <= now()
     ORDER BY scheduled_for LIMIT GREATEST(_limit, 1)
  LOOP
    PERFORM public.anonymize_account(_r.user_id);
    UPDATE public.account_deletion_requests
       SET status = 'completed', completed_at = now() WHERE id = _r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;

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
    ELSIF _job_name = 'sweep_autopublish' THEN
      _rows := public.sweep_autopublish(200);
    ELSIF _job_name = 'sweep_account_deletions' THEN
      _rows := public.sweep_account_deletions(100);
    ELSE
      RAISE EXCEPTION 'UNKNOWN_JOB %', _job_name;
    END IF;
    UPDATE public.cron_runs SET finished_at = now(), rows_processed = _rows WHERE id = _run;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.cron_runs SET finished_at = now(), error = SQLERRM WHERE id = _run;
  END;
END; $function$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sweep-account-deletions-daily';
SELECT cron.schedule('sweep-account-deletions-daily', '15 3 * * *',
  $$SELECT public.run_cron_job('sweep_account_deletions')$$);

-- 7) Admin listing -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_deletion_requests(_status text DEFAULT NULL)
RETURNS TABLE(id uuid, user_id uuid, full_name text, requested_at timestamptz,
              scheduled_for timestamptz, status text, completed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
    SELECT r.id, r.user_id, COALESCE(p.full_name, 'Потребител'), r.requested_at,
           r.scheduled_for, r.status, r.completed_at
      FROM public.account_deletion_requests r
      LEFT JOIN public.profiles p ON p.id = r.user_id
     WHERE _status IS NULL OR r.status = _status
     ORDER BY (r.status = 'pending') DESC, r.scheduled_for;
END; $$;

-- 8) Grants ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.anonymize_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sweep_account_deletions(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_deactivated_author() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_own_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_own_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_account_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_deletion_requests(text) TO authenticated;