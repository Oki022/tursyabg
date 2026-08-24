
-- Helper: cancel pending lifecycle notifications for a task that was closed/assigned/deleted
CREATE OR REPLACE FUNCTION public.suppress_task_lifecycle_notifications(_task_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM public.notifications
  WHERE task_id = _task_id
    AND read_at IS NULL
    AND type IN ('task_expiring','task_expired','task_still_open','task_freshness','promo_expiring');
$function$;

REVOKE ALL ON FUNCTION public.suppress_task_lifecycle_notifications(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suppress_task_lifecycle_notifications(uuid) TO service_role;

-- Sweep: add task-status guards to every expiry/freshness/promo notification
CREATE OR REPLACE FUNCTION public.sweep_expiry_notifications(_batch integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _n integer := 0; _c integer;
BEGIN
  WITH c AS (
    SELECT t.id, t.user_id, t.title FROM public.tasks t
    WHERE t.status = 'active' AND t.deleted_at IS NULL AND t.created_at < now() - interval '3 days'
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
    WHERE t.status = 'active' AND t.deleted_at IS NULL AND t.created_at < now() - interval '14 days' AND t.freshness_prompt_at IS NULL
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
    WHERE status = 'active' AND deleted_at IS NULL AND freshness_prompt_at IS NOT NULL
      AND freshness_prompt_at < now() - interval '7 days'
    ORDER BY freshness_prompt_at LIMIT _batch
  ), upd AS (
    UPDATE public.tasks t SET status = 'inactive' FROM c WHERE t.id = c.id RETURNING 1
  ) SELECT count(*) INTO _c FROM upd; _n := _n + _c;

  WITH c AS (
    SELECT t.id, t.user_id, t.title FROM public.tasks t
    WHERE t.status = 'active' AND t.deleted_at IS NULL AND t.expires_at BETWEEN now() AND now() + interval '3 days'
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
    WHERE t.status = 'active' AND t.deleted_at IS NULL AND t.expires_at < now()
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.task_id = t.id AND n.type = 'task_expired')
    ORDER BY t.expires_at LIMIT _batch
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
    SELECT c.user_id, 'task_expired', 'Задачата ти изтече',
      'Задачата „' || c.title || '“ вече не е активна.', '/task/' || c.id::text, c.id
    FROM c RETURNING 1
  ) SELECT count(*) INTO _c FROM ins; _n := _n + _c;

  WITH c AS (
    SELECT id FROM public.tasks WHERE status = 'active' AND deleted_at IS NULL AND expires_at < now()
    ORDER BY expires_at LIMIT _batch
  ), upd AS (
    UPDATE public.tasks t SET status = 'inactive' FROM c WHERE t.id = c.id RETURNING 1
  ) SELECT count(*) INTO _c FROM upd; _n := _n + _c;

  WITH c AS (
    SELECT p.user_id, p.task_id FROM public.task_promotions p
    JOIN public.tasks t ON t.id = p.task_id
    WHERE p.expires_at BETWEEN now() AND now() + interval '1 day'
      AND t.status = 'active' AND t.deleted_at IS NULL
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

-- Engagement sweep: skip reminders whose task was deleted
CREATE OR REPLACE FUNCTION public.sweep_engagements(_batch integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _n integer := 0; _c integer; e record;
BEGIN
  FOR e IN SELECT e.* FROM public.engagements e
    JOIN public.tasks t ON t.id = e.task_id
    WHERE e.status = 'claimed' AND e.reminded_at IS NULL AND e.claimed_at < now() - interval '3 days'
      AND t.deleted_at IS NULL AND t.status <> 'inactive'
    ORDER BY e.claimed_at LIMIT _batch
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

  FOR e IN SELECT e.* FROM public.engagements e
    JOIN public.tasks t ON t.id = e.task_id
    WHERE e.status = 'confirmed' AND e.review_deadline > now() AND e.confirmed_at < now() - interval '3 days'
      AND t.deleted_at IS NULL
    ORDER BY e.confirmed_at LIMIT _batch
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

-- close_task: suppress pending lifecycle notifications
CREATE OR REPLACE FUNCTION public.close_task(_task_id uuid, _outcome text DEFAULT 'external'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _owner uuid;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  IF _outcome NOT IN ('external','cancelled') THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_OUTCOME'); END IF;
  SELECT user_id INTO _owner FROM public.tasks WHERE id = _task_id;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _owner <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  UPDATE public.tasks
     SET status = CASE WHEN _outcome = 'cancelled' THEN 'inactive'::task_status ELSE 'assigned'::task_status END,
         assigned_at = CASE WHEN _outcome = 'cancelled' THEN assigned_at ELSE now() END
   WHERE id = _task_id;
  PERFORM public.suppress_task_lifecycle_notifications(_task_id);
  RETURN jsonb_build_object('ok', true, 'outcome', _outcome);
END; $function$;

-- assign_engagement: task becomes assigned, suppress pending lifecycle notifications
CREATE OR REPLACE FUNCTION public.assign_engagement(_task_id uuid, _professional_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _owner uuid; _title text; _id uuid; _deadline timestamptz;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT user_id, title INTO _owner, _title FROM public.tasks WHERE id = _task_id;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _owner <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF _professional_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.task_unlocks WHERE task_id = _task_id AND user_id = _professional_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_UNLOCKED'); END IF;
  IF EXISTS (SELECT 1 FROM public.engagements WHERE task_id = _task_id AND professional_id = _professional_id AND status = 'confirmed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CLAIMED'); END IF;

  _deadline := now() + interval '14 days';
  INSERT INTO public.engagements (task_id, client_id, professional_id, status, confirmed_at, review_deadline)
  VALUES (_task_id, _me, _professional_id, 'confirmed', now(), _deadline)
  ON CONFLICT (task_id, professional_id) DO UPDATE
    SET status = 'confirmed', confirmed_at = now(), review_deadline = _deadline
  RETURNING id INTO _id;

  UPDATE public.profiles SET completed_jobs = completed_jobs + 1 WHERE id = _professional_id;

  UPDATE public.tasks SET status = 'assigned', assigned_at = now()
   WHERE id = _task_id AND status <> 'assigned';

  PERFORM public.suppress_task_lifecycle_notifications(_task_id);

  PERFORM public.push_notification(_professional_id, 'engagement_confirmed', 'Клиентът те посочи като изпълнител',
    'Остави отзив за „' || COALESCE(_title,'задачата') || '“ в следващите 14 дни.', '/review/' || _id::text, _task_id);
  PERFORM public.push_notification(_me, 'review_requested', 'Остави отзив',
    'Разкажи как мина работата по „' || COALESCE(_title,'задачата') || '“.', '/review/' || _id::text, _task_id);

  RETURN jsonb_build_object('ok', true, 'engagement_id', _id);
END; $function$;

-- delete_own_task: suppress pending lifecycle notifications
CREATE OR REPLACE FUNCTION public.delete_own_task(_task_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); t public.tasks%ROWTYPE; _row record; _balance int; _refunded int := 0; _credits int := 0;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF t.user_id <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF t.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'refunded_users', 0, 'refunded_credits', 0); END IF;

  FOR _row IN SELECT user_id, credits_spent FROM public.task_unlocks WHERE task_id = _task_id LOOP
    UPDATE public.profiles SET credits = credits + _row.credits_spent
      WHERE id = _row.user_id RETURNING credits INTO _balance;
    INSERT INTO public.credit_transactions (user_id, amount, type, task_id, balance_after, description)
    VALUES (_row.user_id, _row.credits_spent, 'refund', _task_id, _balance,
      'Автоматично възстановяване — подателят изтри задачата');
    PERFORM public.push_notification(_row.user_id, 'refund_auto_approved',
      'Кредитите ти са върнати автоматично',
      'Задачата „' || COALESCE(t.title, 'Задача') || '“ беше изтрита от подателя. Върнати са ти '
        || _row.credits_spent || ' кредита.', '/settings/billing', NULL);
    _refunded := _refunded + 1;
    _credits := _credits + _row.credits_spent;
  END LOOP;

  UPDATE public.tasks SET deleted_at = now(), deleted_reason = COALESCE(_reason, ''), status = 'inactive'
    WHERE id = _task_id;

  PERFORM public.suppress_task_lifecycle_notifications(_task_id);

  INSERT INTO public.task_history (task_id, actor_id, action, changes)
  VALUES (_task_id, _me, 'deleted', jsonb_build_object(
    'reason', COALESCE(_reason, ''), 'refunded_users', _refunded, 'refunded_credits', _credits));

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, details)
  VALUES (NULL, 'task_deleted_by_owner', 'task', _task_id,
    jsonb_build_object('user_id', _me, 'reason', COALESCE(_reason,''),
      'refunded_users', _refunded, 'refunded_credits', _credits));

  RETURN jsonb_build_object('ok', true, 'refunded_users', _refunded, 'refunded_credits', _credits);
END; $function$;

-- admin_delete_task: suppress before hard delete
CREATE OR REPLACE FUNCTION public.admin_delete_task(_task_id uuid, _reason text, _fraudulent boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  PERFORM public.suppress_task_lifecycle_notifications(_task_id);

  PERFORM public.log_admin_action('task_deleted', 'task', _task_id,
    jsonb_build_object('reason', COALESCE(_reason, ''), 'fraudulent', _fraudulent,
      'refunded_users', _refunded, 'refunded_credits', _credits));
  DELETE FROM public.tasks WHERE id = _task_id;
  RETURN jsonb_build_object('ok', true, 'refunded_users', _refunded, 'refunded_credits', _credits);
END; $function$;
