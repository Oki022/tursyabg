-- 1) First-task hold for new accounts (trust_level bypass removed)
CREATE OR REPLACE FUNCTION public.needs_prepublish_review(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE t jsonb; _approved boolean;
BEGIN
  t := public.user_trust(_user_id);
  IF t IS NULL THEN RETURN true; END IF;
  IF (t->>'violations')::int > 0 THEN RETURN true; END IF;

  -- Established account: at least 7 days old AND at least one confirmed engagement.
  IF (t->>'account_age_days')::int >= 7 AND (t->>'confirmed_engagements')::int > 0 THEN
    RETURN false;
  END IF;

  -- Otherwise only the FIRST task is held; once a moderator approved it,
  -- everything later publishes immediately.
  SELECT EXISTS (
    SELECT 1 FROM public.moderation_items m
    WHERE m.user_id = _user_id AND m.content_type = 'task' AND m.status = 'approved'
  ) INTO _approved;
  RETURN NOT _approved;
END; $function$;

-- 2) Refund rule engine must never fail silently
CREATE OR REPLACE FUNCTION public.request_credit_refund(_unlock_id uuid, _reason refund_reason, _details text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  u public.task_unlocks%ROWTYPE;
  _rule text; _auto_count int; _request_id uuid; _res jsonb; _err text;
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

  BEGIN
    _rule := public.evaluate_refund_rule(_unlock_id, _reason);
  EXCEPTION WHEN OTHERS THEN
    _err := SQLSTATE || ': ' || SQLERRM;
    _rule := 'manual';
  END;

  IF _err IS NOT NULL THEN
    INSERT INTO public.cron_runs (job_name, started_at, finished_at, rows_processed, error)
    VALUES ('refund_rule_engine', now(), now(), 0,
      'evaluate_refund_rule failed for unlock ' || _unlock_id || ' — ' || _err);
  END IF;

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
END; $function$;

-- 3) Atomic settlement with ledger consistency assertion
CREATE OR REPLACE FUNCTION public.settle_refund(_request_id uuid, _approve boolean, _note text, _auto boolean, _rule text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.credit_refund_requests%ROWTYPE;
  _credits int; _task uuid; _balance int; _ledger int;
BEGIN
  SELECT * INTO r FROM public.credit_refund_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_RESOLVED'); END IF;

  SELECT credits_spent, task_id INTO _credits, _task FROM public.task_unlocks WHERE id = r.unlock_id;

  IF _approve THEN
    PERFORM 1 FROM public.profiles WHERE id = r.user_id FOR UPDATE;
    UPDATE public.profiles SET credits = credits + COALESCE(_credits, 0)
      WHERE id = r.user_id RETURNING credits INTO _balance;
    IF _balance IS NULL THEN RAISE EXCEPTION 'REFUND_NO_PROFILE:%', r.user_id; END IF;

    INSERT INTO public.credit_transactions (user_id, amount, type, task_id, balance_after, description)
    VALUES (r.user_id, COALESCE(_credits, 0), 'refund', _task, _balance,
      CASE WHEN _auto THEN 'Автоматично възстановяване на кредити' ELSE 'Одобрено възстановяване на кредити' END);

    SELECT COALESCE(sum(amount), 0) INTO _ledger FROM public.credit_transactions WHERE user_id = r.user_id;
    IF _ledger <> _balance THEN
      RAISE EXCEPTION 'REFUND_LEDGER_MISMATCH: balance % vs ledger % for user %', _balance, _ledger, r.user_id;
    END IF;

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
END; $function$;

-- 4) Credit reconciliation visibility
CREATE OR REPLACE FUNCTION public.admin_credit_mismatches()
RETURNS TABLE(user_id uuid, full_name text, credits integer, ledger integer, diff integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.credits,
         COALESCE((SELECT sum(t.amount)::int FROM public.credit_transactions t WHERE t.user_id = p.id), 0),
         p.credits - COALESCE((SELECT sum(t.amount)::int FROM public.credit_transactions t WHERE t.user_id = p.id), 0)
  FROM public.profiles p
  WHERE p.credits <> COALESCE((SELECT sum(t.amount)::int FROM public.credit_transactions t WHERE t.user_id = p.id), 0);
END; $function$;

REVOKE ALL ON FUNCTION public.admin_credit_mismatches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_credit_mismatches() TO authenticated, service_role;

-- dashboard: expose reconciliation + rule-engine errors
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    'violations_30d', (SELECT count(*) FROM public.content_violations WHERE created_at > now() - interval '30 days'),
    'credit_mismatches', (SELECT count(*) FROM public.profiles p
       WHERE p.credits <> COALESCE((SELECT sum(t.amount)::int FROM public.credit_transactions t WHERE t.user_id = p.id), 0)),
    'rule_engine_errors_7d', (SELECT count(*) FROM public.cron_runs
       WHERE job_name = 'refund_rule_engine' AND error IS NOT NULL AND started_at > now() - interval '7 days')
  );
END; $function$;
