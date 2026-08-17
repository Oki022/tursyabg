-- ========== 1. TASK COLUMNS ==========
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS max_unlocks integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS unlock_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS freshness_prompt_at timestamptz,
  ADD COLUMN IF NOT EXISTS category_corrected_at timestamptz;

UPDATE public.tasks t
  SET unlock_count = (SELECT count(*) FROM public.task_unlocks u WHERE u.task_id = t.id);

CREATE OR REPLACE FUNCTION public.tasks_track_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
    IF NEW.status = 'assigned' THEN NEW.assigned_at := now(); END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tasks_track_status_change_trg ON public.tasks;
CREATE TRIGGER tasks_track_status_change_trg BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_track_status_change();

DROP POLICY IF EXISTS tasks_unlocker_read ON public.tasks;
CREATE POLICY tasks_unlocker_read ON public.tasks FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.task_id = tasks.id AND u.user_id = auth.uid()));

-- ========== 2. REFUND REQUEST COLUMNS ==========
ALTER TABLE public.credit_refund_requests
  ADD COLUMN IF NOT EXISTS resolution text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS auto_rule text;

CREATE UNIQUE INDEX IF NOT EXISTS credit_refund_requests_unlock_uidx
  ON public.credit_refund_requests(unlock_id);

-- ========== 3. UNLOCK RPC WITH SLOT LIMIT ==========
CREATE OR REPLACE FUNCTION public.unlock_task_contact(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _task record;
  _existing record;
  _cost int;
  _balance int;
  _unlock_id uuid;
  _phone text;
  _name text;
  _title text;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;

  SELECT id, user_id, status, budget, title, unlock_count, max_unlocks
    INTO _task FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _task.user_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'OWN_TASK'); END IF;

  SELECT full_name INTO _name FROM public.profiles WHERE id = _task.user_id;
  SELECT phone INTO _phone FROM public.profile_contacts WHERE user_id = _task.user_id;

  SELECT * INTO _existing FROM public.task_unlocks WHERE task_id = _task_id AND user_id = _me;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'phone', _phone, 'name', _name,
      'credits_spent', _existing.credits_spent, 'unlock_id', _existing.id);
  END IF;

  IF _task.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error',
      CASE WHEN _task.status = 'assigned' THEN 'TASK_ASSIGNED' ELSE 'TASK_NOT_ACTIVE' END);
  END IF;

  IF _task.unlock_count >= _task.max_unlocks THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNLOCK_LIMIT_REACHED',
      'max_unlocks', _task.max_unlocks);
  END IF;

  _cost := public.get_unlock_cost(_task.budget);

  SELECT credits INTO _balance FROM public.profiles WHERE id = _me FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_CREDITS', 'cost', _cost, 'balance', coalesce(_balance,0));
  END IF;

  UPDATE public.profiles SET credits = credits - _cost WHERE id = _me RETURNING credits INTO _balance;

  INSERT INTO public.task_unlocks (task_id, user_id, credits_spent)
    VALUES (_task_id, _me, _cost) RETURNING id INTO _unlock_id;

  UPDATE public.tasks SET unlock_count = unlock_count + 1 WHERE id = _task_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, task_id, balance_after, description)
    VALUES (_me, -_cost, 'unlock', _task_id, _balance, 'Отключен контакт по задача');

  _title := COALESCE(_task.title, 'Задача');
  PERFORM public.push_notification(
    _task.user_id, 'contact_unlocked',
    'Изпълнител се интересува от твоята задача',
    'Някой отключи контакта по „' || _title || '“.',
    '/task/' || _task_id::text, _task_id
  );

  IF _balance < 5 THEN
    PERFORM public.push_notification(_me, 'credits_low', 'Кредитите ти намаляват',
      'Оставащ баланс: ' || _balance || ' кредита. Купи още, за да отключваш контакти.',
      '/settings/billing', NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'already', false, 'phone', _phone, 'name', _name,
    'credits_spent', _cost, 'balance', _balance, 'unlock_id', _unlock_id,
    'unlock_count', _task.unlock_count + 1, 'max_unlocks', _task.max_unlocks);
END; $$;

-- ========== 4. OWNER TASK CONTROLS ==========
CREATE OR REPLACE FUNCTION public.close_task(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _owner uuid;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT user_id INTO _owner FROM public.tasks WHERE id = _task_id;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _owner <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  UPDATE public.tasks SET status = 'assigned' WHERE id = _task_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_task_active(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _owner uuid;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT user_id INTO _owner FROM public.tasks WHERE id = _task_id;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _owner <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  UPDATE public.tasks
     SET status = 'active', bumped_at = now(), freshness_prompt_at = NULL,
         expires_at = GREATEST(expires_at, now() + interval '30 days')
   WHERE id = _task_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ========== 5. FEED WITH SLOT INFO ==========
DROP FUNCTION IF EXISTS public.feed_tasks(integer, timestamptz, text, integer, text, text, text, text);
CREATE FUNCTION public.feed_tasks(_limit integer DEFAULT 20, _cursor timestamp with time zone DEFAULT NULL,
  _seed text DEFAULT 'seed', _promo_offset integer DEFAULT 0, _category text DEFAULT NULL,
  _city text DEFAULT NULL, _neighborhood text DEFAULT NULL, _q text DEFAULT NULL)
RETURNS TABLE(id uuid, title text, description text, category text, budget numeric, city text,
  neighborhood text, status task_status, unlock_cost integer, created_at timestamptz,
  bumped_at timestamptz, user_id uuid, author text, images text[], is_top boolean, is_urgent boolean,
  promo_expires_at timestamptz, promoted_slot boolean, unlock_count integer, max_unlocks integer)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH base AS (
    SELECT t.* FROM public.tasks t
    WHERE t.status = 'active'
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
    c.top_expires AS promo_expires_at, c.promoted_slot, c.unlock_count, c.max_unlocks
  FROM combined c
  LEFT JOIN public.profiles pr ON pr.id = c.user_id
  ORDER BY c.ord, (CASE WHEN c.ord = 0 THEN md5(_seed || c.id::text) ELSE NULL END), c.bumped_at DESC;
$$;

-- ========== 6. SHARED REFUND SETTLEMENT ==========
CREATE OR REPLACE FUNCTION public.settle_refund(_request_id uuid, _approve boolean, _note text,
  _auto boolean, _rule text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.credit_refund_requests%ROWTYPE;
  _credits int; _task uuid; _balance int;
BEGIN
  SELECT * INTO r FROM public.credit_refund_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_RESOLVED'); END IF;

  SELECT credits_spent, task_id INTO _credits, _task FROM public.task_unlocks WHERE id = r.unlock_id;

  IF _approve THEN
    UPDATE public.profiles SET credits = credits + COALESCE(_credits, 0)
      WHERE id = r.user_id RETURNING credits INTO _balance;
    INSERT INTO public.credit_transactions (user_id, amount, type, task_id, balance_after, description)
    VALUES (r.user_id, COALESCE(_credits, 0), 'refund', _task, _balance,
      CASE WHEN _auto THEN 'Автоматично възстановяване на кредити' ELSE 'Одобрено възстановяване на кредити' END);
    UPDATE public.credit_refund_requests
      SET status = 'approved', resolved_at = now(), resolved_by = CASE WHEN _auto THEN NULL ELSE auth.uid() END,
          admin_note = COALESCE(_note, ''), resolution = CASE WHEN _auto THEN 'auto' ELSE 'manual' END,
          auto_rule = _rule
      WHERE id = _request_id;
    PERFORM public.push_notification(r.user_id,
      CASE WHEN _auto THEN 'refund_auto_approved'::notification_type ELSE 'refund_approved'::notification_type END,
      CASE WHEN _auto THEN 'Кредитите ти са върнати автоматично' ELSE 'Заявката ти за връщане е одобрена' END,
      'Върнати са ти ' || COALESCE(_credits,0) || ' кредита.', '/settings/billing', _task);
  ELSE
    UPDATE public.credit_refund_requests
      SET status = 'rejected', resolved_at = now(), resolved_by = CASE WHEN _auto THEN NULL ELSE auth.uid() END,
          admin_note = COALESCE(_note, ''), resolution = CASE WHEN _auto THEN 'auto' ELSE 'manual' END,
          auto_rule = _rule
      WHERE id = _request_id;
    PERFORM public.push_notification(r.user_id, 'refund_rejected', 'Заявката ти за връщане е отказана',
      COALESCE(_note, ''), '/settings/billing', _task);
  END IF;

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, details)
  VALUES (CASE WHEN _auto THEN NULL ELSE auth.uid() END,
    CASE WHEN _approve THEN 'refund_approved' ELSE 'refund_rejected' END,
    'credit_refund_request', _request_id,
    jsonb_build_object('credits', COALESCE(_credits, 0), 'user_id', r.user_id,
      'note', COALESCE(_note, ''), 'actor', CASE WHEN _auto THEN 'system' ELSE 'admin' END,
      'rule', COALESCE(_rule, '')));

  RETURN jsonb_build_object('ok', true, 'credits', COALESCE(_credits, 0));
END; $$;

ALTER TABLE public.admin_actions ALTER COLUMN admin_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_resolve_refund(_request_id uuid, _approve boolean, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT _approve AND (_note IS NULL OR length(trim(_note)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOTE_REQUIRED');
  END IF;
  RETURN public.settle_refund(_request_id, _approve, _note, false, NULL);
END; $$;

-- ========== 7. RULE EVALUATION + REQUEST RPC ==========
CREATE OR REPLACE FUNCTION public.evaluate_refund_rule(_unlock_id uuid, _reason refund_reason)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u public.task_unlocks%ROWTYPE;
  t public.tasks%ROWTYPE;
  _sent int; _replies int; _reports int;
BEGIN
  SELECT * INTO u FROM public.task_unlocks WHERE id = _unlock_id;
  IF NOT FOUND THEN RETURN 'manual'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id = u.task_id;
  IF NOT FOUND THEN RETURN 'manual'; END IF;

  IF _reason = 'already_taken' THEN
    IF t.status IN ('assigned', 'inactive') AND t.status_changed_at > u.unlocked_at THEN
      RETURN 'already_taken_closed';
    END IF;
  ELSIF _reason = 'no_response' THEN
    IF u.unlocked_at > now() - interval '5 days' THEN RETURN 'too_early'; END IF;
    SELECT count(*) INTO _sent FROM public.messages m
      WHERE m.task_id = t.id AND m.sender_id = u.user_id AND m.receiver_id = t.user_id;
    SELECT count(*) INTO _replies FROM public.messages m
      WHERE m.task_id = t.id AND m.sender_id = t.user_id AND m.receiver_id = u.user_id;
    IF _sent >= 1 AND _replies = 0 THEN RETURN 'no_response_confirmed'; END IF;
  ELSIF _reason = 'fake_task' THEN
    SELECT count(DISTINCT r.reporter_id) INTO _reports FROM public.task_reports r
      WHERE r.task_id = t.id AND r.status IN ('pending', 'reviewed');
    IF _reports >= 3 THEN RETURN 'fake_task_reported'; END IF;
  END IF;

  RETURN 'manual';
END; $$;

CREATE OR REPLACE FUNCTION public.request_credit_refund(_unlock_id uuid, _reason refund_reason, _details text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  u public.task_unlocks%ROWTYPE;
  _rule text; _auto_count int; _request_id uuid; _res jsonb;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;

  SELECT * INTO u FROM public.task_unlocks WHERE id = _unlock_id AND user_id = _me;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF u.unlocked_at < now() - interval '14 days' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WINDOW_EXPIRED');
  END IF;
  IF EXISTS (SELECT 1 FROM public.credit_refund_requests WHERE unlock_id = _unlock_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DUPLICATE');
  END IF;

  _rule := public.evaluate_refund_rule(_unlock_id, _reason);
  IF _rule = 'too_early' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TOO_EARLY',
      'available_at', (u.unlocked_at + interval '5 days'));
  END IF;

  SELECT count(*) INTO _auto_count FROM public.credit_refund_requests
    WHERE user_id = _me AND resolution = 'auto' AND status = 'approved'
      AND resolved_at > now() - interval '30 days';
  IF _auto_count >= 3 THEN _rule := 'manual'; END IF;

  INSERT INTO public.credit_refund_requests (unlock_id, user_id, reason, details)
  VALUES (_unlock_id, _me, _reason, COALESCE(_details, '')) RETURNING id INTO _request_id;

  IF _rule <> 'manual' THEN
    _res := public.settle_refund(_request_id, true, 'Автоматично одобрено по правило', true, _rule);
    IF (_res->>'ok')::boolean THEN
      RETURN jsonb_build_object('ok', true, 'auto', true, 'rule', _rule, 'credits', _res->'credits');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'auto', false, 'request_id', _request_id);
END; $$;

-- ========== 8. ADMIN: FRAUD DELETE + CATEGORY CORRECTION ==========
CREATE OR REPLACE FUNCTION public.admin_delete_task(_task_id uuid, _reason text, _fraudulent boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _refunded int := 0; _row record; _balance int; _title text;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
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
    END LOOP;
  END IF;

  PERFORM public.log_admin_action('task_deleted', 'task', _task_id,
    jsonb_build_object('reason', COALESCE(_reason, ''), 'fraudulent', _fraudulent, 'refunded_users', _refunded));
  DELETE FROM public.tasks WHERE id = _task_id;
  RETURN jsonb_build_object('ok', true, 'refunded_users', _refunded);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_correct_task_category(_task_id uuid, _category text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _row record; _amount int; _balance int; _refunded int := 0; _title text;
BEGIN
  IF _me IS NULL OR NOT public.is_staff(_me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT title INTO _title FROM public.tasks WHERE id = _task_id;
  IF _title IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;

  FOR _row IN SELECT id, user_id, credits_spent FROM public.task_unlocks WHERE task_id = _task_id LOOP
    _amount := CEIL(_row.credits_spent / 2.0)::int;
    IF _amount > 0 THEN
      UPDATE public.profiles SET credits = credits + _amount
        WHERE id = _row.user_id RETURNING credits INTO _balance;
      INSERT INTO public.credit_transactions (user_id, amount, type, task_id, balance_after, description)
      VALUES (_row.user_id, _amount, 'refund', _task_id, _balance,
        'Частично възстановяване — коригирана категория на задачата');
      PERFORM public.push_notification(_row.user_id, 'refund_auto_approved',
        'Върнати са ти кредити',
        'Категорията на „' || _title || '“ беше коригирана. Върнати са ти ' || _amount || ' кредита (50%).',
        '/settings/billing', _task_id);
      _refunded := _refunded + 1;
    END IF;
  END LOOP;

  UPDATE public.tasks SET category = _category, category_corrected_at = now() WHERE id = _task_id;

  PERFORM public.log_admin_action('task_category_changed', 'task', _task_id,
    jsonb_build_object('category', _category, 'refunded_users', _refunded));
  RETURN jsonb_build_object('ok', true, 'refunded_users', _refunded);
END; $$;

-- ========== 9. ABUSE FLAGS + ADMIN LISTS ==========
CREATE OR REPLACE FUNCTION public.is_refund_flagged(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT count(*) FROM public.task_unlocks u WHERE u.user_id = _user_id) >= 5
    AND (SELECT count(*) FROM public.credit_refund_requests r WHERE r.user_id = _user_id)::numeric
        / NULLIF((SELECT count(*) FROM public.task_unlocks u WHERE u.user_id = _user_id), 0) > 0.30,
  false);
$$;

DROP FUNCTION IF EXISTS public.admin_list_users(text, integer);
CREATE FUNCTION public.admin_list_users(_search text, _limit integer DEFAULT 50)
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamptz, credits integer,
  banned_at timestamptz, ban_reason text, task_count bigint, unlock_count bigint,
  total_spent_credits bigint, total_paid_eur numeric, is_moderator boolean, is_admin boolean,
  refund_count bigint, refund_flagged boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT p.id, u.email::text, p.full_name, p.created_at, p.credits, p.banned_at, p.ban_reason,
    (SELECT count(*) FROM public.tasks t WHERE t.user_id = p.id),
    (SELECT count(*) FROM public.task_unlocks tu WHERE tu.user_id = p.id),
    (SELECT COALESCE(-sum(ct.amount), 0) FROM public.credit_transactions ct WHERE ct.user_id = p.id AND ct.amount < 0),
    (SELECT COALESCE(sum(pay.amount_eur), 0) FROM public.payments pay WHERE pay.user_id = p.id AND pay.status = 'completed'),
    public.has_role(p.id, 'moderator'), public.has_role(p.id, 'admin'),
    (SELECT count(*) FROM public.credit_refund_requests rr WHERE rr.user_id = p.id),
    public.is_refund_flagged(p.id)
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE _search IS NULL OR trim(_search) = ''
     OR p.full_name ILIKE '%' || _search || '%' OR u.email ILIKE '%' || _search || '%'
  ORDER BY p.created_at DESC
  LIMIT COALESCE(_limit, 50);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'total_tasks', (SELECT count(*) FROM public.tasks),
    'active_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'active'),
    'assigned_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'assigned'),
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
    'pending_reports', (SELECT count(*) FROM public.task_reports WHERE status = 'pending')
  );
END; $$;

-- ========== 10. REFUND EVIDENCE FOR MODERATORS ==========
CREATE OR REPLACE FUNCTION public.admin_refund_evidence(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.credit_refund_requests%ROWTYPE;
  u public.task_unlocks%ROWTYPE;
  t public.tasks%ROWTYPE;
  _sent int; _replies int; _reports int; _auto int; _unlocks int; _refunds int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.credit_refund_requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT * INTO u FROM public.task_unlocks WHERE id = r.unlock_id;
  SELECT * INTO t FROM public.tasks WHERE id = u.task_id;

  SELECT count(*) INTO _sent FROM public.messages m
    WHERE m.task_id = u.task_id AND m.sender_id = r.user_id;
  SELECT count(*) INTO _replies FROM public.messages m
    WHERE m.task_id = u.task_id AND m.receiver_id = r.user_id;
  SELECT count(DISTINCT rp.reporter_id) INTO _reports FROM public.task_reports rp
    WHERE rp.task_id = u.task_id AND rp.status IN ('pending', 'reviewed');
  SELECT count(*) INTO _auto FROM public.credit_refund_requests c
    WHERE c.user_id = r.user_id AND c.resolution = 'auto' AND c.status = 'approved'
      AND c.resolved_at > now() - interval '30 days';
  SELECT count(*) INTO _unlocks FROM public.task_unlocks tu WHERE tu.user_id = r.user_id;
  SELECT count(*) INTO _refunds FROM public.credit_refund_requests c WHERE c.user_id = r.user_id;

  RETURN jsonb_build_object('found', true,
    'task_status', t.status, 'status_changed_at', t.status_changed_at,
    'unlocked_at', u.unlocked_at, 'days_since_unlock', EXTRACT(day FROM now() - u.unlocked_at)::int,
    'messages_sent', _sent, 'owner_replies', _replies, 'report_count', _reports,
    'auto_refunds_30d', _auto, 'user_unlocks', _unlocks, 'user_refund_requests', _refunds,
    'flagged', public.is_refund_flagged(r.user_id));
END; $$;

-- ========== 11. LIFECYCLE SWEEP ==========
CREATE OR REPLACE FUNCTION public.sweep_expiry_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- day 3: is your task still open?
  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  SELECT t.user_id, 'task_still_open', 'Още ли търсиш изпълнител?',
    'Ако вече си възложил „' || t.title || '“, затвори задачата — така специалистите няма да харчат кредити напразно.',
    '/task/' || t.id::text, t.id
  FROM public.tasks t
  WHERE t.status = 'active' AND t.created_at < now() - interval '3 days'
    AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.task_id = t.id AND n.type = 'task_still_open');

  -- day 14: confirm the task is still active
  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  SELECT t.user_id, 'task_freshness', 'Задачата ти още ли е актуална?',
    'Потвърди, че „' || t.title || '“ е активна. Без потвърждение я деактивираме след 7 дни.',
    '/task/' || t.id::text, t.id
  FROM public.tasks t
  WHERE t.status = 'active' AND t.created_at < now() - interval '14 days' AND t.freshness_prompt_at IS NULL;

  UPDATE public.tasks SET freshness_prompt_at = now()
   WHERE status = 'active' AND created_at < now() - interval '14 days' AND freshness_prompt_at IS NULL;

  -- no answer within 7 days of the prompt -> inactive
  UPDATE public.tasks SET status = 'inactive'
   WHERE status = 'active' AND freshness_prompt_at IS NOT NULL
     AND freshness_prompt_at < now() - interval '7 days';

  -- expired tasks -> inactive
  UPDATE public.tasks SET status = 'inactive' WHERE status = 'active' AND expires_at < now();

  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  SELECT t.user_id, 'task_expiring', 'Задачата ти изтича скоро',
         'Задачата „' || t.title || '“ изтича след по-малко от 3 дни.', '/task/' || t.id::text, t.id
  FROM public.tasks t
  WHERE t.status = 'active' AND t.expires_at BETWEEN now() AND now() + interval '3 days'
    AND NOT EXISTS (SELECT 1 FROM public.notifications n
      WHERE n.task_id = t.id AND n.type = 'task_expiring' AND n.created_at > now() - interval '3 days');

  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  SELECT t.user_id, 'task_expired', 'Задачата ти изтече',
         'Задачата „' || t.title || '“ вече не е активна.', '/task/' || t.id::text, t.id
  FROM public.tasks t
  WHERE t.expires_at < now()
    AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.task_id = t.id AND n.type = 'task_expired');

  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  SELECT p.user_id, 'promo_expiring', 'Промоцията ти изтича утре',
         'Промоцията по задачата ти изтича след по-малко от 24 часа.', '/task/' || p.task_id::text, p.task_id
  FROM public.task_promotions p
  WHERE p.expires_at BETWEEN now() AND now() + interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM public.notifications n
      WHERE n.task_id = p.task_id AND n.type = 'promo_expiring' AND n.created_at > now() - interval '1 day');
END; $$;

REVOKE EXECUTE ON FUNCTION public.settle_refund(uuid, boolean, text, boolean, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sweep_expiry_notifications() FROM anon, authenticated;