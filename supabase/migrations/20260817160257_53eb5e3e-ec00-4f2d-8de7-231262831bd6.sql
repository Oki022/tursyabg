
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'new_message','contact_unlocked','task_expiring','task_expired',
    'promo_expiring','credits_low','refund_approved','refund_rejected','task_reported'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications (user_id, read_at);

CREATE OR REPLACE FUNCTION public.push_notification(
  _user_id uuid, _type public.notification_type, _title text, _body text, _link text, _task_id uuid
) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  VALUES (_user_id, _type, _title, COALESCE(_body,''), _link, _task_id)
  RETURNING id;
$$;

-- New message -> notify receiver
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sender text;
BEGIN
  SELECT COALESCE(full_name, 'Потребител') INTO _sender FROM public.profiles WHERE id = NEW.sender_id;
  PERFORM public.push_notification(
    NEW.receiver_id, 'new_message',
    'Ново съобщение от ' || COALESCE(_sender, 'Потребител'),
    left(NEW.content, 120),
    CASE WHEN NEW.conversation_id IS NOT NULL THEN '/messages/' || NEW.conversation_id::text ELSE '/messages' END,
    NEW.task_id
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS messages_notify_trg ON public.messages;
CREATE TRIGGER messages_notify_trg AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Unlock RPC: notify task owner + low balance warning
CREATE OR REPLACE FUNCTION public.unlock_task_contact(_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT id, user_id, status, budget, title INTO _task FROM public.tasks WHERE id = _task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _task.user_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'OWN_TASK'); END IF;

  SELECT full_name INTO _name FROM public.profiles WHERE id = _task.user_id;
  SELECT phone INTO _phone FROM public.profile_contacts WHERE user_id = _task.user_id;

  SELECT * INTO _existing FROM public.task_unlocks WHERE task_id = _task_id AND user_id = _me;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'phone', _phone, 'name', _name,
      'credits_spent', _existing.credits_spent, 'unlock_id', _existing.id);
  END IF;

  IF _task.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_ACTIVE'); END IF;

  _cost := public.get_unlock_cost(_task.budget);

  SELECT credits INTO _balance FROM public.profiles WHERE id = _me FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_CREDITS', 'cost', _cost, 'balance', coalesce(_balance,0));
  END IF;

  UPDATE public.profiles SET credits = credits - _cost WHERE id = _me RETURNING credits INTO _balance;

  INSERT INTO public.task_unlocks (task_id, user_id, credits_spent)
    VALUES (_task_id, _me, _cost) RETURNING id INTO _unlock_id;

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
    PERFORM public.push_notification(
      _me, 'credits_low',
      'Кредитите ти намаляват',
      'Оставащ баланс: ' || _balance || ' кредита. Купи още, за да отключваш контакти.',
      '/settings/billing', NULL
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'already', false, 'phone', _phone, 'name', _name,
    'credits_spent', _cost, 'balance', _balance, 'unlock_id', _unlock_id);
END;
$function$;

-- Refund resolution notifications
CREATE OR REPLACE FUNCTION public.admin_resolve_refund(_request_id uuid, _approve boolean, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  r public.credit_refund_requests%ROWTYPE;
  _credits int;
  _task uuid;
  _balance int;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO r FROM public.credit_refund_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_RESOLVED'); END IF;

  SELECT credits_spent, task_id INTO _credits, _task FROM public.task_unlocks WHERE id = r.unlock_id;

  IF _approve THEN
    UPDATE public.profiles SET credits = credits + COALESCE(_credits, 0)
      WHERE id = r.user_id RETURNING credits INTO _balance;
    INSERT INTO public.credit_transactions (user_id, amount, type, task_id, balance_after, description)
    VALUES (r.user_id, COALESCE(_credits, 0), 'refund', _task, _balance, 'Одобрено възстановяване на кредити');
    UPDATE public.credit_refund_requests
      SET status = 'approved', resolved_at = now(), resolved_by = _me, admin_note = COALESCE(_note, '')
      WHERE id = _request_id;
    PERFORM public.push_notification(r.user_id, 'refund_approved',
      'Заявката ти за връщане е одобрена',
      'Върнати са ти ' || COALESCE(_credits,0) || ' кредита.',
      '/settings/billing', _task);
  ELSE
    IF _note IS NULL OR length(trim(_note)) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOTE_REQUIRED');
    END IF;
    UPDATE public.credit_refund_requests
      SET status = 'rejected', resolved_at = now(), resolved_by = _me, admin_note = _note
      WHERE id = _request_id;
    PERFORM public.push_notification(r.user_id, 'refund_rejected',
      'Заявката ти за връщане е отказана',
      _note, '/settings/billing', _task);
  END IF;

  PERFORM public.log_admin_action(
    CASE WHEN _approve THEN 'refund_approved' ELSE 'refund_rejected' END,
    'credit_refund_request', _request_id,
    jsonb_build_object('credits', COALESCE(_credits, 0), 'user_id', r.user_id, 'note', COALESCE(_note, ''))
  );

  RETURN jsonb_build_object('ok', true, 'credits', COALESCE(_credits, 0));
END;
$function$;

-- Scheduled-style sweep for expiring tasks/promotions (idempotent per day)
CREATE OR REPLACE FUNCTION public.sweep_expiry_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  SELECT t.user_id, 'task_expiring', 'Задачата ти изтича скоро',
         'Задачата „' || t.title || '“ изтича след по-малко от 3 дни.',
         '/task/' || t.id::text, t.id
  FROM public.tasks t
  WHERE t.status = 'active' AND t.expires_at BETWEEN now() AND now() + interval '3 days'
    AND NOT EXISTS (SELECT 1 FROM public.notifications n
      WHERE n.task_id = t.id AND n.type = 'task_expiring' AND n.created_at > now() - interval '3 days');

  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  SELECT t.user_id, 'task_expired', 'Задачата ти изтече',
         'Задачата „' || t.title || '“ вече не е активна.',
         '/task/' || t.id::text, t.id
  FROM public.tasks t
  WHERE t.expires_at < now()
    AND NOT EXISTS (SELECT 1 FROM public.notifications n
      WHERE n.task_id = t.id AND n.type = 'task_expired');

  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  SELECT p.user_id, 'promo_expiring', 'Промоцията ти изтича утре',
         'Промоцията по задачата ти изтича след по-малко от 24 часа.',
         '/task/' || p.task_id::text, p.task_id
  FROM public.task_promotions p
  WHERE p.expires_at BETWEEN now() AND now() + interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM public.notifications n
      WHERE n.task_id = p.task_id AND n.type = 'promo_expiring' AND n.created_at > now() - interval '1 day');
END; $$;
