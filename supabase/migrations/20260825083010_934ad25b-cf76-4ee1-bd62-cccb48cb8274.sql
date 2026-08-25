-- 1. "Спешно" promo: 7 days -> 3 days
UPDATE public.promo_products
SET duration_days = 3, code = 'urgent_3', name_bg = REPLACE(name_bg, '7 дни', '3 дни')
WHERE code = 'urgent_7';

-- 2. New report reason value
ALTER TYPE public.report_reason ADD VALUE IF NOT EXISTS 'stale';

-- 3. Remove the self-service refund request path
DROP POLICY IF EXISTS credit_refund_requests_own_insert ON public.credit_refund_requests;
DROP POLICY IF EXISTS credit_refund_requests_own_read ON public.credit_refund_requests;
DROP FUNCTION IF EXISTS public.request_credit_refund(uuid, public.refund_reason, text);
DROP FUNCTION IF EXISTS public.evaluate_refund_rule(uuid, public.refund_reason);

-- 4. Category correction no longer refunds 50% to unlockers
CREATE OR REPLACE FUNCTION public.admin_correct_task_category(_task_id uuid, _category text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _title text;
BEGIN
  IF _me IS NULL OR NOT public.is_staff(_me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT title INTO _title FROM public.tasks WHERE id = _task_id;
  IF _title IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;

  UPDATE public.tasks SET category = _category, category_corrected_at = now() WHERE id = _task_id;

  PERFORM public.log_admin_action('task_category_changed', 'task', _task_id,
    jsonb_build_object('category', _category));
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- 5. Gate conversations behind the contact unlock (owner can always reply)
CREATE OR REPLACE FUNCTION public.find_or_create_conversation(_task_id uuid, _other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _a uuid;
  _b uuid;
  _id uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _other_user = _me THEN
    RAISE EXCEPTION 'cannot message yourself';
  END IF;

  -- Non-owners may start a conversation only after unlocking the contact.
  IF NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.user_id = _me)
     AND NOT EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.task_id = _task_id AND u.user_id = _me) THEN
    RAISE EXCEPTION 'unlock required' USING ERRCODE = '42501';
  END IF;

  _a := LEAST(_me, _other_user);
  _b := GREATEST(_me, _other_user);

  INSERT INTO public.conversations (task_id, participant_a, participant_b)
  VALUES (_task_id, _a, _b)
  ON CONFLICT (task_id, participant_a, participant_b) DO UPDATE
    SET last_message_at = public.conversations.last_message_at
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$;

-- 6. Same gate at message-insert level
DROP POLICY IF EXISTS messages_sender_insert ON public.messages;
CREATE POLICY messages_sender_insert ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND (conversation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())))
  AND (task_id IS NULL
       OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = messages.task_id AND t.user_id = auth.uid())
       OR EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.task_id = messages.task_id AND u.user_id = auth.uid()))
);

-- 7. Owners may delete only closed/archived tasks
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
  IF t.status NOT IN ('inactive', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CLOSE_FIRST');
  END IF;

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
END;
$function$;