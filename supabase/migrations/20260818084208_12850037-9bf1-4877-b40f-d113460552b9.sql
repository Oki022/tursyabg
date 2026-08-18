-- ============ 1. SOFT DELETE ============
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_reason text;

DROP POLICY IF EXISTS tasks_public_read_active ON public.tasks;
CREATE POLICY tasks_public_read_active ON public.tasks FOR SELECT
USING (
  status = 'active' AND deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = tasks.user_id AND p.banned_at IS NOT NULL)
);

DROP POLICY IF EXISTS tasks_unlocker_read ON public.tasks;
CREATE POLICY tasks_unlocker_read ON public.tasks FOR SELECT
USING (EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.task_id = tasks.id AND u.user_id = auth.uid()));

-- ============ 2. TASK HISTORY ============
CREATE TABLE IF NOT EXISTS public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.task_history TO authenticated;
GRANT ALL ON public.task_history TO service_role;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_history_staff_read ON public.task_history;
CREATE POLICY task_history_staff_read ON public.task_history FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS task_history_owner_read ON public.task_history;
CREATE POLICY task_history_owner_read ON public.task_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_history.task_id AND t.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS task_history_task_idx ON public.task_history (task_id, created_at DESC);

-- ============ 3. FEED EXCLUDES DELETED ============
CREATE OR REPLACE FUNCTION public.feed_tasks(_limit integer DEFAULT 20, _cursor timestamp with time zone DEFAULT NULL::timestamp with time zone, _seed text DEFAULT 'seed'::text, _promo_offset integer DEFAULT 0, _category text DEFAULT NULL::text, _city text DEFAULT NULL::text, _neighborhood text DEFAULT NULL::text, _q text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, title text, description text, category text, budget numeric, city text, neighborhood text, status task_status, unlock_cost integer, created_at timestamp with time zone, bumped_at timestamp with time zone, user_id uuid, author text, images text[], is_top boolean, is_urgent boolean, promo_expires_at timestamp with time zone, promoted_slot boolean, unlock_count integer, max_unlocks integer, author_rating numeric, author_review_count integer)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT t.* FROM public.tasks t
    WHERE t.status = 'active' AND t.deleted_at IS NULL
      AND (_category IS NULL OR t.category = _category)
      AND (_city IS NULL OR t.city = _city)
      AND (_neighborhood IS NULL OR t.neighborhood = _neighborhood)
      AND (_q IS NULL OR _q = '' OR t.title ILIKE '%' || _q || '%' OR t.description ILIKE '%' || _q || '%')
  ),
  tops AS (
    SELECT b.*, tp.expires_at AS top_expires FROM base b
    JOIN LATERAL (
      SELECT MAX(p.expires_at) AS expires_at FROM public.task_promotions p
      WHERE p.task_id = b.id AND p.type = 'top' AND p.expires_at > now()
    ) tp ON tp.expires_at IS NOT NULL
  ),
  promoted AS (
    SELECT * FROM tops ORDER BY md5(_seed || tops.id::text)
    LIMIT LEAST(GREATEST(_limit, 1), 4) OFFSET GREATEST(_promo_offset, 0)
  ),
  normal AS (
    SELECT b.* FROM base b
    WHERE NOT EXISTS (SELECT 1 FROM tops t WHERE t.id = b.id)
      AND (_cursor IS NULL OR b.bumped_at < _cursor)
    ORDER BY b.bumped_at DESC LIMIT GREATEST(_limit, 1)
  ),
  combined AS (
    SELECT p.*, true AS promoted_slot, 0 AS ord FROM promoted p
    UNION ALL
    SELECT n.*, NULL::timestamptz AS top_expires, false AS promoted_slot, 1 AS ord FROM normal n
  )
  SELECT c.id, c.title, c.description, c.category, c.budget, c.city, c.neighborhood, c.status,
    c.unlock_cost, c.created_at, c.bumped_at, c.user_id, pr.full_name AS author,
    COALESCE((SELECT array_agg(i.image_url ORDER BY i.sort_order) FROM public.task_images i WHERE i.task_id = c.id), ARRAY[]::text[]) AS images,
    (c.top_expires IS NOT NULL) AS is_top,
    EXISTS (SELECT 1 FROM public.task_promotions u WHERE u.task_id = c.id AND u.type = 'urgent' AND u.expires_at > now()) AS is_urgent,
    c.top_expires AS promo_expires_at, c.promoted_slot, c.unlock_count, c.max_unlocks,
    pr.rating_as_client AS author_rating, pr.review_count_as_client AS author_review_count
  FROM combined c
  LEFT JOIN public.profiles pr ON pr.id = c.user_id
  ORDER BY c.ord, (CASE WHEN c.ord = 0 THEN md5(_seed || c.id::text) ELSE NULL END), c.bumped_at DESC;
$function$;

-- ============ 4. OWNER EDIT ============
CREATE OR REPLACE FUNCTION public.update_own_task(
  _task_id uuid, _title text, _description text, _category text,
  _budget numeric, _city text, _neighborhood text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); t public.tasks%ROWTYPE; v jsonb; _pending boolean := false; _changes jsonb;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF t.user_id <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF t.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_DELETED'); END IF;
  IF _title IS NULL OR length(trim(_title)) < 3 OR _description IS NULL OR length(trim(_description)) < 3
     OR _category IS NULL OR _budget IS NULL OR _budget < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF COALESCE(t.unlock_count, 0) > 0 AND _budget < t.budget THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BUDGET_LOCKED');
  END IF;

  v := public.moderate_text(COALESCE(_title,'') || E'\n' || COALESCE(_description,''));
  IF v->>'verdict' = 'block' THEN
    PERFORM public.record_content_violation(_me, 'task', _task_id, v->>'category', 'block', true);
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_BLOCKED:' || COALESCE(v->>'category',''));
  END IF;

  _pending := (v->>'verdict' = 'flag') OR public.needs_prepublish_review(_me);

  _changes := jsonb_build_object(
    'title', jsonb_build_array(t.title, _title),
    'description_changed', (t.description IS DISTINCT FROM _description),
    'category', jsonb_build_array(t.category, _category),
    'budget', jsonb_build_array(t.budget, _budget),
    'location', jsonb_build_array(concat_ws(', ', t.city, t.neighborhood), concat_ws(', ', _city, _neighborhood)));

  UPDATE public.tasks SET
    title = _title, description = _description, category = _category, budget = _budget,
    city = _city, neighborhood = _neighborhood,
    status = CASE WHEN _pending AND t.status IN ('active','pending') THEN 'pending'::task_status ELSE t.status END
  WHERE id = _task_id;

  INSERT INTO public.task_history (task_id, actor_id, action, changes)
  VALUES (_task_id, _me, 'edited', _changes || jsonb_build_object('held', _pending));

  IF _pending AND t.status IN ('active','pending') THEN
    PERFORM public.enqueue_moderation('text', 'task', _task_id, _task_id, _me,
      CASE WHEN v->>'verdict' = 'flag' THEN 'medium' ELSE 'low' END,
      CASE WHEN v->>'verdict' = 'flag' THEN 'Редакция със съвпадение по правило' ELSE 'Редакция от профил в проверка' END,
      COALESCE(v->>'category',''), v->>'pattern',
      COALESCE(_title,'') || ' — ' || COALESCE(_description,''),
      jsonb_build_object('trust', public.user_trust(_me), 'edit', true));
    PERFORM public.push_notification(_me, 'content_held', 'Промените чакат преглед',
      'Проверяваме редакцията на „' || _title || '“ преди тя да стане публична.', '/profile', _task_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'pending', _pending);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.update_own_task(uuid, text, text, text, numeric, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_own_task(uuid, text, text, text, numeric, text, text) TO authenticated;

-- ============ 5. OWNER DELETE (soft, with refunds) ============
CREATE OR REPLACE FUNCTION public.own_task_delete_preview(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _users int; _credits int;
BEGIN
  IF _me IS NULL OR NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = _task_id AND user_id = _me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  SELECT count(*), COALESCE(sum(credits_spent), 0) INTO _users, _credits
    FROM public.task_unlocks WHERE task_id = _task_id;
  RETURN jsonb_build_object('ok', true, 'unlockers', _users, 'credits', _credits);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.own_task_delete_preview(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.own_task_delete_preview(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_own_task(_task_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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

  INSERT INTO public.task_history (task_id, actor_id, action, changes)
  VALUES (_task_id, _me, 'deleted', jsonb_build_object(
    'reason', COALESCE(_reason, ''), 'refunded_users', _refunded, 'refunded_credits', _credits));

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, details)
  VALUES (NULL, 'task_deleted_by_owner', 'task', _task_id,
    jsonb_build_object('user_id', _me, 'reason', COALESCE(_reason,''),
      'refunded_users', _refunded, 'refunded_credits', _credits));

  RETURN jsonb_build_object('ok', true, 'refunded_users', _refunded, 'refunded_credits', _credits);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.delete_own_task(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_task(uuid, text) TO authenticated;

-- ============ 6. TRUST / FIRST-TASK REVIEW ============
CREATE OR REPLACE FUNCTION public.needs_prepublish_review(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE t jsonb; _approved boolean;
BEGIN
  t := public.user_trust(_user_id);
  IF t IS NULL THEN RETURN true; END IF;
  IF (t->>'violations')::int > 0 THEN RETURN true; END IF;
  IF (t->>'confirmed_engagements')::int > 0 THEN RETURN false; END IF;
  IF (t->>'trust_level')::int >= 1 THEN RETURN false; END IF;
  IF (t->>'account_age_days')::int >= 7 THEN RETURN false; END IF;

  -- Young account: only the FIRST task is held. Once a moderator approved it,
  -- everything later publishes immediately.
  SELECT EXISTS (
    SELECT 1 FROM public.moderation_items m
    WHERE m.user_id = _user_id AND m.content_type = 'task' AND m.status = 'approved'
  ) INTO _approved;
  RETURN NOT _approved;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.needs_prepublish_review(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.record_content_violation(_user_id uuid, _content_type text, _content_id uuid,
  _violation_type text, _severity text, _auto boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _n int; _action text;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT count(*) + 1 INTO _n FROM public.content_violations
    WHERE user_id = _user_id AND reverted_at IS NULL;

  UPDATE public.profiles SET trust_level = GREATEST(trust_level - 1, 0) WHERE id = _user_id;

  IF _n = 1 THEN
    _action := 'warning';
    PERFORM public.push_notification(_user_id, 'moderation_warning', 'Предупреждение за съдържание',
      'Съдържанието ти беше отхвърлено заради нарушение на правилата (' || _violation_type ||
      '). При повторно нарушение ще ограничим публикуването.', '/terms', NULL);
  ELSIF _n = 2 THEN
    _action := 'suspension_7d';
    UPDATE public.profiles SET suspended_until = now() + interval '7 days' WHERE id = _user_id;
    PERFORM public.push_notification(_user_id, 'account_suspended', 'Публикуването е спряно за 7 дни',
      'Това е второ нарушение на правилата за съдържание (' || _violation_type || ').', '/terms', NULL);
  ELSE
    _action := 'ban';
    PERFORM public.ban_user_cascade(_user_id, 'Трето нарушение на правилата за съдържание: ' || _violation_type);
  END IF;

  INSERT INTO public.content_violations (user_id, content_type, content_id, violation_type, severity, auto_detected, action_taken)
  VALUES (_user_id, _content_type, _content_id, _violation_type, COALESCE(_severity,'block'), COALESCE(_auto,true), _action);

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, details)
  VALUES (NULL, 'content_violation', _content_type, _content_id,
    jsonb_build_object('user_id', _user_id, 'violation', _violation_type, 'action', _action, 'count', _n, 'auto', _auto));

  RETURN jsonb_build_object('ok', true, 'count', _n, 'action', _action);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.record_content_violation(uuid, text, uuid, text, text, boolean) FROM anon, authenticated;

-- ============ 7. CONTACT MESSAGES ============
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contact_message';

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  handled_by uuid REFERENCES auth.users(id),
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_messages_insert_anyone ON public.contact_messages;
CREATE POLICY contact_messages_insert_anyone ON public.contact_messages FOR INSERT TO anon, authenticated
WITH CHECK (
  length(trim(name)) BETWEEN 2 AND 120
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  AND subject IN ('support', 'payment', 'report_user', 'other')
  AND length(trim(body)) BETWEEN 10 AND 4000
  AND status = 'new'
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS contact_messages_staff_read ON public.contact_messages;
CREATE POLICY contact_messages_staff_read ON public.contact_messages FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS contact_messages_staff_update ON public.contact_messages;
CREATE POLICY contact_messages_staff_update ON public.contact_messages FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS contact_messages_set_updated_at ON public.contact_messages;
CREATE TRIGGER contact_messages_set_updated_at BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON public.contact_messages (status, created_at DESC);

-- Spam guard: max 5 submissions per hour from the same account or email.
CREATE OR REPLACE FUNCTION public.contact_messages_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _n int;
BEGIN
  SELECT count(*) INTO _n FROM public.contact_messages c
  WHERE c.created_at > now() - interval '1 hour'
    AND (lower(c.email) = lower(NEW.email) OR (NEW.user_id IS NOT NULL AND c.user_id = NEW.user_id));
  IF _n >= 5 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS contact_messages_rate_limit_trg ON public.contact_messages;
CREATE TRIGGER contact_messages_rate_limit_trg BEFORE INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.contact_messages_rate_limit();

-- Staff notification on every new submission.
CREATE OR REPLACE FUNCTION public.contact_messages_notify_staff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _staff uuid;
BEGIN
  FOR _staff IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','moderator') LOOP
    PERFORM public.push_notification(_staff, 'contact_message', 'Ново съобщение от контактната форма',
      NEW.name || ': ' || left(NEW.body, 120), '/admin/contact', NULL);
  END LOOP;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS contact_messages_notify_staff_trg ON public.contact_messages;
CREATE TRIGGER contact_messages_notify_staff_trg AFTER INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.contact_messages_notify_staff();

CREATE OR REPLACE FUNCTION public.admin_set_contact_status(_id uuid, _status text, _note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL OR NOT public.is_staff(_me) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF _status NOT IN ('new','in_progress','resolved') THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS'); END IF;
  UPDATE public.contact_messages SET status = _status, handled_by = _me, admin_note = COALESCE(_note, '')
    WHERE id = _id;
  PERFORM public.log_admin_action('contact_status_changed', 'contact_message', _id,
    jsonb_build_object('status', _status));
  RETURN jsonb_build_object('ok', true);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_contact_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_contact_status(uuid, text, text) TO authenticated;

-- ============ 8. DASHBOARD: PENDING TASK QUEUE ============
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'total_tasks', (SELECT count(*) FROM public.tasks WHERE deleted_at IS NULL),
    'active_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'active' AND deleted_at IS NULL),
    'assigned_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'assigned' AND deleted_at IS NULL),
    'tasks_7d', (SELECT count(*) FROM public.tasks WHERE created_at > now() - interval '7 days'),
    'tasks_30d', (SELECT count(*) FROM public.tasks WHERE created_at > now() - interval '30 days'),
    'credits_sold', (SELECT COALESCE(sum(credits), 0) FROM public.payments WHERE status = 'completed'),
    'revenue_total', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed'),
    'revenue_7d', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed' AND completed_at > now() - interval '7 days'),
    'revenue_30d', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed' AND completed_at > now() - interval '30 days'),
    'unlocks_total', (SELECT count(*) FROM public.task_unlocks),
    'pending_refunds', (SELECT count(*) FROM public.credit_refund_requests WHERE status = 'pending'),
    'auto_refunds_30d', (SELECT count(*) FROM public.credit_refund_requests WHERE resolution = 'auto' AND resolved_at > now() - interval '30 days'),
    'manual_refunds_30d', (SELECT count(*) FROM public.credit_refund_requests WHERE resolution = 'manual' AND resolved_at > now() - interval '30 days'),
    'flagged_users', (SELECT count(*) FROM public.profiles p WHERE public.is_refund_flagged(p.id)),
    'pending_reports', (SELECT count(*) FROM public.task_reports WHERE status = 'pending'),
    'moderation_pending', (SELECT count(*) FROM public.moderation_items WHERE status = 'pending'),
    'moderation_oldest', (SELECT min(created_at) FROM public.moderation_items WHERE status = 'pending'),
    'tasks_pending', (SELECT count(*) FROM public.tasks WHERE status = 'pending' AND deleted_at IS NULL),
    'tasks_pending_oldest', (SELECT min(created_at) FROM public.tasks WHERE status = 'pending' AND deleted_at IS NULL),
    'contact_new', (SELECT count(*) FROM public.contact_messages WHERE status = 'new'),
    'violations_30d', (SELECT count(*) FROM public.content_violations WHERE created_at > now() - interval '30 days')
  );
END; $function$;