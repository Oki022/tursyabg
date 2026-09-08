-- 1. Notification grouping: the new account-critical kinds always deliver.
CREATE OR REPLACE FUNCTION public.notification_group(_type notification_type)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $function$
  SELECT CASE _type
    WHEN 'new_message' THEN 'messages'
    WHEN 'task_expiring' THEN 'tasks'
    WHEN 'task_expired' THEN 'tasks'
    WHEN 'task_still_open' THEN 'tasks'
    WHEN 'task_freshness' THEN 'tasks'
    WHEN 'task_category_changed' THEN 'tasks'
    WHEN 'promo_expiring' THEN 'promotions'
    WHEN 'credits_low' THEN 'credits'
    WHEN 'contact_unlocked' THEN 'credits'
    WHEN 'review_requested' THEN 'reviews'
    WHEN 'review_reminder' THEN 'reviews'
    WHEN 'review_published' THEN 'reviews'
    WHEN 'engagement_claimed' THEN 'reviews'
    WHEN 'engagement_confirmed' THEN 'reviews'
    WHEN 'engagement_rejected' THEN 'reviews'
    WHEN 'engagement_reminder' THEN 'reviews'
    WHEN 'content_approved' THEN 'moderation'
    WHEN 'task_reported' THEN 'moderation'
    ELSE NULL
  END;
$function$;

-- 2. Credit adjustments notify the user, in the same transaction.
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user_id uuid, _amount integer, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _balance int; _title text; _body text; _signed text;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF _amount = 0 OR _reason IS NULL OR length(trim(_reason)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  UPDATE public.profiles SET credits = GREATEST(credits + _amount, 0)
    WHERE id = _user_id RETURNING credits INTO _balance;
  IF _balance IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND'); END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, balance_after, description)
  VALUES (_user_id, _amount, 'bonus', _balance, _reason);

  _signed := CASE WHEN _amount > 0 THEN '+' || _amount ELSE _amount::text END || ' кредита';

  IF _amount > 0 THEN
    _title := 'Начислени са ти ' || _amount || ' кредита';
    _body := _signed || '. Новият ти баланс е ' || _balance || ' кредита. Причина: ' || trim(_reason)
      || ' Кредитите вече са в профила ти и можеш да ги използваш веднага.';
  ELSE
    _title := 'Балансът ти беше коригиран';
    _body := _signed || '. Новият ти баланс е ' || _balance || ' кредита. Причина: ' || trim(_reason)
      || ' Ако смяташ, че корекцията е грешна, пиши ни през страницата Контакти и ще я проверим.';
  END IF;

  PERFORM public.push_notification(_user_id, 'credits_adjusted', _title, _body, '/settings/billing', NULL);

  PERFORM public.log_admin_action('credits_adjusted', 'profile', _user_id,
    jsonb_build_object('amount', _amount, 'reason', _reason, 'balance_after', _balance));

  RETURN jsonb_build_object('ok', true, 'balance', _balance);
END;
$function$;

-- 3. Unblocking an account tells the user.
CREATE OR REPLACE FUNCTION public.admin_set_ban(_user_id uuid, _banned boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    PERFORM public.push_notification(_user_id, 'account_restored', 'Профилът ти е възстановен',
      'Ограничението върху профила ти е свалено. Отново можеш да влизаш, да публикуваш задачи и да пишеш съобщения.',
      '/profile', NULL);
    _res := jsonb_build_object('ok', true);
  END IF;

  PERFORM public.log_admin_action(CASE WHEN _banned THEN 'user_banned' ELSE 'user_unbanned' END,
    'profile', _user_id, jsonb_build_object('reason', COALESCE(_reason, ''), 'cascade', _res));
  RETURN _res;
END; $function$;

-- 4. Removing a task tells its author.
CREATE OR REPLACE FUNCTION public.admin_delete_task(_task_id uuid, _reason text, _fraudulent boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _refunded int := 0; _credits int := 0; _row record; _balance int;
        _title text; _owner uuid;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF _fraudulent IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FRAUD_FLAG_REQUIRED');
  END IF;

  SELECT title, user_id INTO _title, _owner FROM public.tasks WHERE id = _task_id;

  IF _fraudulent THEN
    FOR _row IN SELECT id, user_id, credits_spent FROM public.task_unlocks WHERE task_id = _task_id LOOP
      UPDATE public.profiles SET credits = credits + _row.credits_spent
        WHERE id = _row.user_id RETURNING credits INTO _balance;
      INSERT INTO public.credit_transactions (user_id, amount, type, balance_after, description)
      VALUES (_row.user_id, _row.credits_spent, 'refund', _balance,
        'Автоматично възстановяване, задачата е премахната като измамна');
      PERFORM public.push_notification(_row.user_id, 'refund_auto_approved',
        'Кредитите ти са върнати автоматично',
        'Задачата „' || COALESCE(_title, 'Задача') || '“ беше премахната като измамна. Върнати са ти '
          || _row.credits_spent || ' кредита.', '/settings/billing', NULL);
      _refunded := _refunded + 1;
      _credits := _credits + _row.credits_spent;
    END LOOP;
  END IF;

  IF _owner IS NOT NULL AND _owner <> _me THEN
    PERFORM public.push_notification(_owner, 'task_removed', 'Задачата ти беше премахната',
      'Задачата „' || COALESCE(_title, 'Задача') || '“ беше премахната от екипа. '
        || CASE WHEN COALESCE(trim(_reason), '') = '' THEN 'Причина: нарушение на правилата за съдържание.'
                ELSE 'Причина: ' || trim(_reason) END
        || ' Ако смяташ, че има грешка, пиши ни през страницата Контакти.',
      '/terms', NULL);
  END IF;

  PERFORM public.suppress_task_lifecycle_notifications(_task_id);

  PERFORM public.log_admin_action('task_deleted', 'task', _task_id,
    jsonb_build_object('reason', COALESCE(_reason, ''), 'fraudulent', _fraudulent,
      'refunded_users', _refunded, 'refunded_credits', _credits));
  DELETE FROM public.tasks WHERE id = _task_id;
  RETURN jsonb_build_object('ok', true, 'refunded_users', _refunded, 'refunded_credits', _credits);
END; $function$;

-- 5. Category corrections tell the author.
CREATE OR REPLACE FUNCTION public.admin_correct_task_category(_task_id uuid, _category text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _title text; _owner uuid;
BEGIN
  IF _me IS NULL OR NOT public.is_staff(_me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT title, user_id INTO _title, _owner FROM public.tasks WHERE id = _task_id;
  IF _title IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;

  UPDATE public.tasks SET category = _category, category_corrected_at = now() WHERE id = _task_id;

  IF _owner IS NOT NULL AND _owner <> _me THEN
    PERFORM public.push_notification(_owner, 'task_category_changed', 'Категорията на задачата ти е сменена',
      'Задачата „' || COALESCE(_title, 'Задача') || '“ беше преместена в по-подходяща категория, за да я намират точните изпълнители.',
      '/task/' || _task_id::text, _task_id);
  END IF;

  PERFORM public.log_admin_action('task_category_changed', 'task', _task_id,
    jsonb_build_object('category', _category));
  RETURN jsonb_build_object('ok', true);
END; $function$;

-- 6. Hiding a review tells its author.
CREATE OR REPLACE FUNCTION public.admin_hide_review(_review_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _reviewee uuid; _reviewer uuid;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED'); END IF;
  UPDATE public.reviews SET hidden_at = now(), hidden_reason = _reason WHERE id = _review_id
    RETURNING reviewee_id, reviewer_id INTO _reviewee, _reviewer;
  IF _reviewee IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  UPDATE public.review_reports SET status = 'reviewed' WHERE review_id = _review_id AND status = 'pending';
  PERFORM public.recompute_review_aggregates(_reviewee);

  IF _reviewer IS NOT NULL AND _reviewer <> _me THEN
    PERFORM public.push_notification(_reviewer, 'review_removed', 'Отзивът ти беше скрит',
      'Отзивът ти вече не се показва публично. Причина: ' || trim(_reason)
        || ' Ако смяташ, че има грешка, пиши ни през страницата Контакти.', '/terms', NULL);
  END IF;

  PERFORM public.log_admin_action('review_hidden', 'review', _review_id, jsonb_build_object('reason', _reason));
  RETURN jsonb_build_object('ok', true);
END; $function$;

-- 7. One phone number, one account.
DELETE FROM public.profile_contacts a
  USING public.profile_contacts b
  WHERE a.phone IS NOT NULL AND a.phone = b.phone AND a.updated_at < b.updated_at;

CREATE UNIQUE INDEX IF NOT EXISTS profile_contacts_phone_unique
  ON public.profile_contacts (phone) WHERE phone IS NOT NULL AND phone <> '';

CREATE OR REPLACE FUNCTION public.is_phone_available(_phone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profile_contacts c
    WHERE c.phone = trim(_phone) AND c.user_id IS DISTINCT FROM auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.set_my_phone(_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _p text := trim(COALESCE(_phone, ''));
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  IF _p = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED'); END IF;
  IF NOT public.is_valid_bg_phone(_p) THEN RETURN jsonb_build_object('ok', false, 'error', 'PHONE_INVALID'); END IF;
  IF EXISTS (SELECT 1 FROM public.profile_contacts c WHERE c.phone = _p AND c.user_id <> _me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_TAKEN');
  END IF;

  INSERT INTO public.profile_contacts (user_id, phone) VALUES (_me, _p)
    ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'phone', _p);
END; $function$;

REVOKE ALL ON FUNCTION public.is_phone_available(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_phone_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_phone(text) TO authenticated;