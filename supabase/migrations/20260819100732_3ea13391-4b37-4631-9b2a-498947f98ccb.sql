-- 1. Restore the admin account
UPDATE public.profiles
SET banned_at = NULL, ban_reason = NULL, suspended_until = NULL, trust_level = GREATEST(trust_level, 3)
WHERE id IN (SELECT id FROM auth.users WHERE email = 'ivan@example.bg');

UPDATE public.content_violations SET reverted_at = now()
WHERE reverted_at IS NULL
  AND user_id IN (SELECT id FROM auth.users WHERE email = 'ivan@example.bg');

-- Helper: is this the last non-banned admin?
CREATE OR REPLACE FUNCTION public.is_last_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin')
     AND (SELECT count(*) FROM public.user_roles ur
          JOIN public.profiles p ON p.id = ur.user_id
          WHERE ur.role = 'admin' AND p.banned_at IS NULL) <= 1;
$$;

REVOKE ALL ON FUNCTION public.is_last_admin(uuid) FROM PUBLIC, anon, authenticated;

-- 2. Never ban the last admin
CREATE OR REPLACE FUNCTION public.ban_user_cascade(_user_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _row record; _balance int; _refunded int := 0; _credits int := 0;
BEGIN
  IF public.is_last_admin(_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LAST_ADMIN');
  END IF;

  UPDATE public.profiles SET banned_at = now(), ban_reason = _reason WHERE id = _user_id;

  FOR _row IN
    SELECT u.user_id, u.credits_spent FROM public.task_unlocks u
    JOIN public.tasks t ON t.id = u.task_id
    WHERE t.user_id = _user_id AND u.unlocked_at > now() - interval '30 days'
  LOOP
    UPDATE public.profiles SET credits = credits + _row.credits_spent
      WHERE id = _row.user_id RETURNING credits INTO _balance;
    INSERT INTO public.credit_transactions (user_id, amount, type, balance_after, description)
    VALUES (_row.user_id, _row.credits_spent, 'refund', _balance,
      'Автоматично възстановяване — профилът на подателя беше блокиран');
    PERFORM public.push_notification(_row.user_id, 'refund_auto_approved',
      'Кредитите ти са върнати', 'Профилът на подателя беше блокиран. Върнати са ти '
        || _row.credits_spent || ' кредита.', '/settings/billing', NULL);
    _refunded := _refunded + 1;
    _credits := _credits + _row.credits_spent;
  END LOOP;

  UPDATE public.tasks SET status = 'inactive' WHERE user_id = _user_id AND status <> 'inactive';

  PERFORM public.push_notification(_user_id, 'account_banned', 'Профилът ти е блокиран',
    COALESCE(_reason, 'Нарушение на правилата за съдържание.') || ' Ако смяташ, че има грешка, свържи се с екипа.',
    '/terms', NULL);

  RETURN jsonb_build_object('ok', true, 'refunded_users', _refunded, 'refunded_credits', _credits);
END; $function$;

-- 3. Staff are exempt from automatic enforcement
CREATE OR REPLACE FUNCTION public.record_content_violation(_user_id uuid, _content_type text, _content_id uuid, _violation_type text, _severity text, _auto boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _n int; _action text;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  IF public.is_staff(_user_id) THEN
    INSERT INTO public.content_violations (user_id, content_type, content_id, violation_type, severity, auto_detected, action_taken)
    VALUES (_user_id, _content_type, _content_id, _violation_type, COALESCE(_severity,'block'), COALESCE(_auto,true), 'exempt_staff');
    INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, details)
    VALUES (NULL, 'content_violation', _content_type, _content_id,
      jsonb_build_object('user_id', _user_id, 'violation', _violation_type, 'action', 'exempt_staff', 'auto', _auto));
    RETURN jsonb_build_object('ok', true, 'action', 'exempt_staff');
  END IF;

  SELECT count(*) + 1 INTO _n FROM public.content_violations
    WHERE user_id = _user_id AND reverted_at IS NULL AND action_taken <> 'exempt_staff';

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

-- 4. Rejecting your own content is not a violation; staff exempt
CREATE OR REPLACE FUNCTION public.admin_resolve_moderation(_item_id uuid, _approve boolean, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); m public.moderation_items%ROWTYPE; _title text; _pending int;
BEGIN
  IF _me IS NULL OR NOT public.is_staff(_me) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  SELECT * INTO m FROM public.moderation_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF m.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_RESOLVED'); END IF;
  IF NOT _approve AND (_reason IS NULL OR length(trim(_reason)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;

  SELECT title INTO _title FROM public.tasks WHERE id = m.task_id;

  IF _approve THEN
    IF m.content_type = 'task_image' THEN
      UPDATE public.task_images SET moderation_status = 'approved' WHERE id = m.content_id;
    END IF;
    IF m.task_id IS NOT NULL THEN
      SELECT count(*) INTO _pending FROM public.task_images ti
        WHERE ti.task_id = m.task_id AND ti.moderation_status = 'pending' AND ti.id <> COALESCE(m.content_id, '00000000-0000-0000-0000-000000000000'::uuid);
      IF _pending = 0 AND EXISTS (SELECT 1 FROM public.tasks WHERE id = m.task_id AND status = 'pending')
         AND NOT EXISTS (SELECT 1 FROM public.moderation_items o WHERE o.task_id = m.task_id AND o.id <> m.id AND o.status = 'pending' AND o.kind <> 'report') THEN
        UPDATE public.tasks SET status = 'active', bumped_at = now() WHERE id = m.task_id;
        PERFORM public.push_notification(m.user_id, 'content_approved', 'Задачата ти е публикувана',
          '„' || COALESCE(_title,'Задача') || '“ премина проверката и вече е видима за изпълнителите.',
          '/task/' || m.task_id::text, m.task_id);
      END IF;
    END IF;
  ELSE
    IF m.content_type = 'task_image' THEN
      UPDATE public.task_images SET moderation_status = 'rejected' WHERE id = m.content_id;
      DELETE FROM public.task_images WHERE id = m.content_id;
    ELSIF m.content_type = 'review' THEN
      UPDATE public.reviews SET hidden_at = now(), hidden_reason = _reason WHERE id = m.content_id;
      PERFORM public.recompute_review_aggregates((SELECT reviewee_id FROM public.reviews WHERE id = m.content_id));
    ELSIF m.content_type IN ('task') AND m.task_id IS NOT NULL THEN
      UPDATE public.tasks SET status = 'inactive' WHERE id = m.task_id;
    END IF;

    IF m.user_id IS DISTINCT FROM _me AND NOT public.is_staff(m.user_id) THEN
      PERFORM public.record_content_violation(m.user_id, m.content_type, m.content_id,
        COALESCE(NULLIF(m.category,''), 'other'), 'block', false);
      PERFORM public.push_notification(m.user_id, 'content_rejected', 'Съдържанието ти беше отхвърлено',
        _reason || ' Прегледай правилата за съдържание и поправи публикацията.', '/terms', m.task_id);
    END IF;
  END IF;

  UPDATE public.moderation_items
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        resolved_by = _me, resolved_at = now(), resolution_reason = _reason
    WHERE id = _item_id;

  PERFORM public.log_admin_action(CASE WHEN _approve THEN 'moderation_approved' ELSE 'moderation_rejected' END,
    m.content_type, m.content_id, jsonb_build_object('item_id', _item_id, 'reason', COALESCE(_reason,'')));

  RETURN jsonb_build_object('ok', true);
END; $function$;

-- 5. Admin ban action: refuse to ban the last admin, and full restore on unban
CREATE OR REPLACE FUNCTION public.admin_set_ban(_user_id uuid, _banned boolean, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _res jsonb;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF _banned AND (_reason IS NULL OR length(trim(_reason)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;
  IF _user_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF _banned AND public.is_last_admin(_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LAST_ADMIN');
  END IF;

  IF _banned THEN
    _res := public.ban_user_cascade(_user_id, _reason);
    IF NOT COALESCE((_res->>'ok')::boolean, false) THEN RETURN _res; END IF;
  ELSE
    UPDATE public.profiles SET banned_at = NULL, ban_reason = NULL, suspended_until = NULL,
      trust_level = GREATEST(trust_level, 1) WHERE id = _user_id;
    UPDATE public.content_violations SET reverted_at = now() WHERE user_id = _user_id AND reverted_at IS NULL;
    _res := jsonb_build_object('ok', true);
  END IF;

  PERFORM public.log_admin_action(CASE WHEN _banned THEN 'user_banned' ELSE 'user_unbanned' END,
    'profile', _user_id, jsonb_build_object('reason', COALESCE(_reason, ''), 'cascade', _res));
  RETURN _res;
END; $function$;