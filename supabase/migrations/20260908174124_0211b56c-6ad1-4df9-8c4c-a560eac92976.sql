
-- ============ SETTINGS ============
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are readable" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Staff manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.app_settings(key, value, description) VALUES
  ('welcome_bonus_credits', '50'::jsonb, 'Брой безплатни кредити при регистрация. 0 изключва бонуса.'),
  ('sms_verification_required', 'false'::jsonb, 'Изисква потвърден телефон при публикуване на задача и отключване на контакт.');

CREATE OR REPLACE FUNCTION public.app_setting_int(_key text, _default integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = _key), _default);
$$;

CREATE OR REPLACE FUNCTION public.app_setting_bool(_key text, _default boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value #>> '{}')::boolean FROM public.app_settings WHERE key = _key), _default);
$$;

-- ============ PROFILE COLUMNS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_bonus_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- ============ WELCOME BONUS ============
CREATE OR REPLACE FUNCTION public.grant_welcome_bonus(_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _amount int; _balance int;
BEGIN
  _amount := public.app_setting_int('welcome_bonus_credits', 0);
  IF _amount <= 0 THEN RETURN 0; END IF;
  IF public.is_staff(_user_id) THEN RETURN 0; END IF;

  UPDATE public.profiles
     SET credits = credits + _amount, welcome_bonus_granted_at = now()
   WHERE id = _user_id
     AND welcome_bonus_granted_at IS NULL
     AND deactivated_at IS NULL
     AND anonymized_at IS NULL
  RETURNING credits INTO _balance;

  IF _balance IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, balance_after, description)
  VALUES (_user_id, _amount, 'bonus', _balance, 'Бонус кредити за нова регистрация');

  PERFORM public.push_notification(
    _user_id, 'credits_adjusted',
    'Подарък: ' || _amount || ' безплатни кредита',
    'Добре дошъл! Получи ' || _amount || ' кредита, с които можеш да отключиш контакт по задача, която те интересува. Едно отключване струва между 5 и 80 кредита според бюджета на задачата. Виж как работят кредитите в помощния раздел.',
    '/faq#krediti', NULL);

  RETURN _amount;
END; $$;
REVOKE ALL ON FUNCTION public.grant_welcome_bonus(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.profiles_welcome_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.grant_welcome_bonus(NEW.id);
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS profiles_welcome_bonus_trg ON public.profiles;
CREATE TRIGGER profiles_welcome_bonus_trg
AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_welcome_bonus();

-- ============ UNCONFIRMED ACCOUNT CLEANUP ============
CREATE TABLE public.unconfirmed_account_notices (
  user_id uuid PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  day7_sent_at timestamptz,
  day25_sent_at timestamptz,
  flagged_at timestamptz,
  flag_reason text NOT NULL DEFAULT '',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.unconfirmed_account_notices TO service_role;
ALTER TABLE public.unconfirmed_account_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read unconfirmed notices" ON public.unconfirmed_account_notices
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
GRANT SELECT ON public.unconfirmed_account_notices TO authenticated;

CREATE OR REPLACE FUNCTION public.unconfirmed_reminder_batch(_limit integer DEFAULT 100)
RETURNS TABLE(user_id uuid, email text, stage integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email::text,
    CASE WHEN u.created_at < now() - interval '25 days' THEN 25 ELSE 7 END
  FROM auth.users u
  LEFT JOIN public.unconfirmed_account_notices n ON n.user_id = u.id
  WHERE u.email_confirmed_at IS NULL
    AND u.deleted_at IS NULL
    AND u.email IS NOT NULL
    AND u.created_at < now() - interval '7 days'
    AND u.created_at > now() - interval '30 days'
    AND CASE WHEN u.created_at < now() - interval '25 days'
             THEN n.day25_sent_at IS NULL
             ELSE n.day7_sent_at IS NULL END
  ORDER BY u.created_at
  LIMIT _limit;
END; $$;
REVOKE ALL ON FUNCTION public.unconfirmed_reminder_batch(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_unconfirmed_reminder(_user_id uuid, _email text, _stage integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.unconfirmed_account_notices (user_id, email, day7_sent_at, day25_sent_at)
  VALUES (_user_id, COALESCE(_email, ''),
          CASE WHEN _stage = 7 THEN now() END,
          CASE WHEN _stage = 25 THEN now() END)
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    day7_sent_at = CASE WHEN _stage = 7 THEN now() ELSE public.unconfirmed_account_notices.day7_sent_at END,
    day25_sent_at = CASE WHEN _stage = 25 THEN now() ELSE public.unconfirmed_account_notices.day25_sent_at END;
END; $$;
REVOKE ALL ON FUNCTION public.mark_unconfirmed_reminder(uuid, text, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sweep_unconfirmed_accounts(_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u record; _count int := 0; _reason text;
BEGIN
  FOR _u IN
    SELECT id, email::text AS email FROM auth.users
    WHERE email_confirmed_at IS NULL
      AND deleted_at IS NULL
      AND created_at < now() - interval '30 days'
    ORDER BY created_at
    LIMIT _limit
  LOOP
    _reason := '';
    IF EXISTS (SELECT 1 FROM public.tasks WHERE user_id = _u.id) THEN _reason := 'има задачи'; END IF;
    IF EXISTS (SELECT 1 FROM public.messages WHERE sender_id = _u.id OR receiver_id = _u.id)
      THEN _reason := trim(both ', ' FROM _reason || ', има съобщения'); END IF;
    IF EXISTS (SELECT 1 FROM public.payments WHERE user_id = _u.id)
      THEN _reason := trim(both ', ' FROM _reason || ', има плащания'); END IF;

    IF _reason <> '' THEN
      INSERT INTO public.unconfirmed_account_notices (user_id, email, flagged_at, flag_reason)
      VALUES (_u.id, _u.email, now(), _reason)
      ON CONFLICT (user_id) DO UPDATE SET flagged_at = now(), flag_reason = EXCLUDED.flag_reason;
    ELSE
      DELETE FROM public.notifications WHERE user_id = _u.id;
      DELETE FROM public.credit_transactions WHERE user_id = _u.id;
      DELETE FROM public.profile_contacts WHERE user_id = _u.id;
      DELETE FROM public.notification_preferences WHERE user_id = _u.id;
      DELETE FROM auth.users WHERE id = _u.id;
      INSERT INTO public.unconfirmed_account_notices (user_id, email, deleted_at)
      VALUES (_u.id, _u.email, now())
      ON CONFLICT (user_id) DO UPDATE SET deleted_at = now();
      _count := _count + 1;
    END IF;
  END LOOP;
  RETURN _count;
END; $$;
REVOKE ALL ON FUNCTION public.sweep_unconfirmed_accounts(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_cron_job(_job_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $function$
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
    ELSIF _job_name = 'sweep_unconfirmed_accounts' THEN
      _rows := public.sweep_unconfirmed_accounts(100);
    ELSE
      RAISE EXCEPTION 'UNKNOWN_JOB %', _job_name;
    END IF;
    UPDATE public.cron_runs SET finished_at = now(), rows_processed = _rows WHERE id = _run;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.cron_runs SET finished_at = now(), error = SQLERRM WHERE id = _run;
  END;
END; $function$;

SELECT cron.schedule('sweep-unconfirmed-accounts-daily', '45 3 * * *',
  $$SELECT public.run_cron_job('sweep_unconfirmed_accounts')$$);

-- ============ SMS PHONE VERIFICATION ============
CREATE TABLE public.phone_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX phone_verification_codes_phone_idx ON public.phone_verification_codes (phone, created_at DESC);
GRANT ALL ON public.phone_verification_codes TO service_role;
ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.phone_verification_locks (
  phone text PRIMARY KEY,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.phone_verification_locks TO service_role;
ALTER TABLE public.phone_verification_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.start_phone_verification(_user_id uuid, _phone text, _code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _last timestamptz; _hour int; _day int; _lock timestamptz;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  IF NOT public.is_valid_bg_phone(_phone) THEN RETURN jsonb_build_object('ok', false, 'error', 'PHONE_INVALID'); END IF;

  SELECT locked_until INTO _lock FROM public.phone_verification_locks WHERE phone = _phone;
  IF _lock IS NOT NULL AND _lock > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LOCKED', 'until', _lock);
  END IF;

  SELECT max(created_at) INTO _last FROM public.phone_verification_codes WHERE phone = _phone;
  IF _last IS NOT NULL AND _last > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'COOLDOWN',
      'retry_after', ceil(extract(epoch FROM (_last + interval '60 seconds' - now()))));
  END IF;

  SELECT count(*) INTO _hour FROM public.phone_verification_codes
    WHERE phone = _phone AND created_at > now() - interval '1 hour';
  IF _hour >= 3 THEN RETURN jsonb_build_object('ok', false, 'error', 'HOURLY_LIMIT'); END IF;

  SELECT count(*) INTO _day FROM public.phone_verification_codes
    WHERE phone = _phone AND created_at > now() - interval '1 day';
  IF _day >= 5 THEN RETURN jsonb_build_object('ok', false, 'error', 'DAILY_LIMIT'); END IF;

  UPDATE public.phone_verification_codes SET consumed_at = now()
   WHERE user_id = _user_id AND consumed_at IS NULL;

  INSERT INTO public.phone_verification_codes (user_id, phone, code_hash, expires_at)
  VALUES (_user_id, _phone, _code_hash, now() + interval '5 minutes');

  RETURN jsonb_build_object('ok', true, 'expires_in', 300);
END; $$;
REVOKE ALL ON FUNCTION public.start_phone_verification(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirm_phone_verification(_user_id uuid, _code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.phone_verification_codes; _lock timestamptz; _failed int;
BEGIN
  SELECT * INTO _row FROM public.phone_verification_codes
   WHERE user_id = _user_id AND consumed_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  IF _row.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NO_CODE'); END IF;

  SELECT locked_until INTO _lock FROM public.phone_verification_locks WHERE phone = _row.phone;
  IF _lock IS NOT NULL AND _lock > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LOCKED', 'until', _lock);
  END IF;

  IF _row.expires_at < now() THEN
    UPDATE public.phone_verification_codes SET consumed_at = now() WHERE id = _row.id;
    RETURN jsonb_build_object('ok', false, 'error', 'EXPIRED');
  END IF;

  IF _row.code_hash <> _code_hash THEN
    UPDATE public.phone_verification_codes SET attempts = attempts + 1 WHERE id = _row.id;
    INSERT INTO public.phone_verification_locks (phone, failed_attempts, updated_at)
    VALUES (_row.phone, 1, now())
    ON CONFLICT (phone) DO UPDATE SET
      failed_attempts = public.phone_verification_locks.failed_attempts + 1,
      updated_at = now(),
      locked_until = CASE WHEN public.phone_verification_locks.failed_attempts + 1 >= 5
                          THEN now() + interval '1 hour' END
    RETURNING failed_attempts INTO _failed;
    RETURN jsonb_build_object('ok', false, 'error', 'WRONG_CODE', 'attempts_left', greatest(0, 5 - COALESCE(_failed, 1)));
  END IF;

  UPDATE public.phone_verification_codes SET consumed_at = now() WHERE id = _row.id;
  DELETE FROM public.phone_verification_locks WHERE phone = _row.phone;
  UPDATE public.profiles SET phone_verified_at = now() WHERE id = _user_id;

  RETURN jsonb_build_object('ok', true, 'phone', _row.phone);
END; $$;
REVOKE ALL ON FUNCTION public.confirm_phone_verification(uuid, text) FROM PUBLIC, anon, authenticated;

-- Changing the phone number clears the verified state.
CREATE OR REPLACE FUNCTION public.set_my_phone(_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _p text := trim(COALESCE(_phone, '')); _old text;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  IF _p = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED'); END IF;
  IF NOT public.is_valid_bg_phone(_p) THEN RETURN jsonb_build_object('ok', false, 'error', 'PHONE_INVALID'); END IF;
  IF EXISTS (SELECT 1 FROM public.profile_contacts c WHERE c.phone = _p AND c.user_id <> _me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_TAKEN');
  END IF;

  SELECT phone INTO _old FROM public.profile_contacts WHERE user_id = _me;

  INSERT INTO public.profile_contacts (user_id, phone) VALUES (_me, _p)
    ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = now();

  IF _old IS DISTINCT FROM _p THEN
    UPDATE public.profiles SET phone_verified_at = NULL WHERE id = _me;
    UPDATE public.phone_verification_codes SET consumed_at = now()
      WHERE user_id = _me AND consumed_at IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true, 'phone', _p);
END; $$;

-- Gate: only active while the setting is on.
CREATE OR REPLACE FUNCTION public.require_phone_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.app_setting_bool('sms_verification_required', false) THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND phone_verified_at IS NOT NULL) THEN
      RAISE EXCEPTION 'PHONE_NOT_VERIFIED';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tasks_require_phone_verified ON public.tasks;
CREATE TRIGGER tasks_require_phone_verified BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.require_phone_verified();

DROP TRIGGER IF EXISTS unlocks_require_phone_verified ON public.task_unlocks;
CREATE TRIGGER unlocks_require_phone_verified BEFORE INSERT ON public.task_unlocks
FOR EACH ROW EXECUTE FUNCTION public.require_phone_verified();

-- ============ ADMIN DASHBOARD ============
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _auto int; _manual int; _held int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT count(*) FILTER (WHERE status = 'approved' AND resolved_by IS NULL),
         count(*) FILTER (WHERE status <> 'pending' AND resolved_by IS NOT NULL),
         count(*) FILTER (WHERE status = 'pending' OR resolved_by IS NOT NULL)
    INTO _auto, _manual, _held
    FROM public.moderation_items WHERE created_at > now() - interval '7 days';

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
    'moderation_auto_7d', _auto,
    'moderation_manual_7d', _manual,
    'moderation_auto_rate_7d', CASE WHEN (_auto + _held) > 0
      THEN round((_auto::numeric * 100) / (_auto + _held), 1) ELSE NULL END,
    'service_ad_blocks_30d', (SELECT count(*) FROM public.content_violations
       WHERE violation_type = 'service_ad' AND created_at > now() - interval '30 days'),
    'service_ad_blocks_7d', (SELECT count(*) FROM public.content_violations
       WHERE violation_type = 'service_ad' AND created_at > now() - interval '7 days'),
    'service_ad_flags_30d', (SELECT count(*) FROM public.moderation_items
       WHERE category = 'service_ad' AND created_at > now() - interval '30 days'),
    'tasks_pending', (SELECT count(*) FROM public.tasks WHERE status = 'pending' AND deleted_at IS NULL),
    'tasks_pending_oldest', (SELECT min(created_at) FROM public.tasks WHERE status = 'pending' AND deleted_at IS NULL),
    'contact_new', (SELECT count(*) FROM public.contact_messages WHERE status = 'new'),
    'violations_30d', (SELECT count(*) FROM public.content_violations WHERE created_at > now() - interval '30 days'),
    'credit_mismatches', (SELECT count(*) FROM public.profiles p
       WHERE p.credits <> COALESCE((SELECT sum(t.amount)::int FROM public.credit_transactions t WHERE t.user_id = p.id), 0)),
    'rule_engine_errors_7d', (SELECT count(*) FROM public.cron_runs
       WHERE job_name = 'refund_rule_engine' AND error IS NOT NULL AND started_at > now() - interval '7 days'),
    'welcome_bonus_amount', public.app_setting_int('welcome_bonus_credits', 0),
    'welcome_bonus_total', (SELECT COALESCE(sum(amount), 0) FROM public.credit_transactions
       WHERE type = 'bonus' AND description = 'Бонус кредити за нова регистрация'),
    'welcome_bonus_7d', (SELECT COALESCE(sum(amount), 0) FROM public.credit_transactions
       WHERE type = 'bonus' AND description = 'Бонус кредити за нова регистрация' AND created_at > now() - interval '7 days'),
    'welcome_bonus_users_7d', (SELECT count(*) FROM public.profiles
       WHERE welcome_bonus_granted_at > now() - interval '7 days'),
    'unconfirmed_deleted_30d', (SELECT count(*) FROM public.unconfirmed_account_notices
       WHERE deleted_at > now() - interval '30 days'),
    'unconfirmed_flagged', (SELECT count(*) FROM public.unconfirmed_account_notices
       WHERE flagged_at IS NOT NULL AND deleted_at IS NULL),
    'phone_verified_users', (SELECT count(*) FROM public.profiles WHERE phone_verified_at IS NOT NULL)
  );
END; $function$;
