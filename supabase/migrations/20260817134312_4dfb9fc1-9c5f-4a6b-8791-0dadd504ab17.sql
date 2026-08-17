-- 1. ROLES
CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','moderator'));
$$;

CREATE POLICY user_roles_own_read ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_roles_admin_read ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. BANS
ALTER TABLE public.profiles ADD COLUMN banned_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN ban_reason text;

DROP POLICY IF EXISTS tasks_public_read_active ON public.tasks;
CREATE POLICY tasks_public_read_active ON public.tasks
  FOR SELECT TO public
  USING (
    status = 'active'::task_status
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = tasks.user_id AND p.banned_at IS NOT NULL)
  );

DROP POLICY IF EXISTS tasks_owner_insert ON public.tasks;
CREATE POLICY tasks_owner_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.banned_at IS NOT NULL)
  );

CREATE POLICY tasks_staff_read ON public.tasks
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY tasks_staff_update ON public.tasks
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY tasks_admin_delete ON public.tasks
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY task_images_staff_read ON public.task_images
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 3. AUDIT LOG
CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_actions_created_idx ON public.admin_actions (created_at DESC);

GRANT SELECT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_actions_staff_read ON public.admin_actions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_admin_action(_action_type text, _target_type text, _target_id uuid, _details jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), _action_type, _target_type, _target_id, COALESCE(_details, '{}'::jsonb));
$$;

-- 4. REPORTS
CREATE TYPE public.report_reason AS ENUM ('spam', 'fraud', 'inappropriate', 'wrong_category', 'duplicate', 'other');
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'dismissed');

CREATE TABLE public.task_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason public.report_reason NOT NULL,
  details text NOT NULL DEFAULT '',
  status public.report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, reporter_id)
);

GRANT SELECT, INSERT ON public.task_reports TO authenticated;
GRANT UPDATE ON public.task_reports TO authenticated;
GRANT ALL ON public.task_reports TO service_role;
ALTER TABLE public.task_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_reports_own_insert ON public.task_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY task_reports_own_read ON public.task_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY task_reports_staff_read ON public.task_reports
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY task_reports_staff_update ON public.task_reports
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 5. REFUND REQUESTS: admin fields + policies
ALTER TABLE public.credit_refund_requests ADD COLUMN admin_note text NOT NULL DEFAULT '';
ALTER TABLE public.credit_refund_requests ADD COLUMN resolved_by uuid REFERENCES auth.users(id);

CREATE POLICY credit_refund_requests_staff_read ON public.credit_refund_requests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY credit_transactions_staff_read ON public.credit_transactions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY task_unlocks_staff_read ON public.task_unlocks
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY payments_staff_read ON public.payments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 6. ADMIN OPERATIONS
CREATE OR REPLACE FUNCTION public.admin_resolve_refund(_request_id uuid, _approve boolean, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  ELSE
    IF _note IS NULL OR length(trim(_note)) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOTE_REQUIRED');
    END IF;
    UPDATE public.credit_refund_requests
      SET status = 'rejected', resolved_at = now(), resolved_by = _me, admin_note = _note
      WHERE id = _request_id;
  END IF;

  PERFORM public.log_admin_action(
    CASE WHEN _approve THEN 'refund_approved' ELSE 'refund_rejected' END,
    'credit_refund_request', _request_id,
    jsonb_build_object('credits', COALESCE(_credits, 0), 'user_id', r.user_id, 'note', COALESCE(_note, ''))
  );

  RETURN jsonb_build_object('ok', true, 'credits', COALESCE(_credits, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user_id uuid, _amount int, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _me uuid := auth.uid(); _balance int;
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

  PERFORM public.log_admin_action('credits_adjusted', 'profile', _user_id,
    jsonb_build_object('amount', _amount, 'reason', _reason, 'balance_after', _balance));

  RETURN jsonb_build_object('ok', true, 'balance', _balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_ban(_user_id uuid, _banned boolean, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF _banned AND (_reason IS NULL OR length(trim(_reason)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;
  IF _user_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;

  UPDATE public.profiles
    SET banned_at = CASE WHEN _banned THEN now() ELSE NULL END,
        ban_reason = CASE WHEN _banned THEN _reason ELSE NULL END
    WHERE id = _user_id;

  PERFORM public.log_admin_action(CASE WHEN _banned THEN 'user_banned' ELSE 'user_unbanned' END,
    'profile', _user_id, jsonb_build_object('reason', COALESCE(_reason, '')));

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role, _grant boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF _role = 'admin' THEN RETURN jsonb_build_object('ok', false, 'error', 'ADMIN_ROLE_MANUAL_ONLY'); END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;

  PERFORM public.log_admin_action(CASE WHEN _grant THEN 'role_granted' ELSE 'role_revoked' END,
    'profile', _user_id, jsonb_build_object('role', _role));

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_task(_task_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  PERFORM public.log_admin_action('task_deleted', 'task', _task_id,
    jsonb_build_object('reason', COALESCE(_reason, '')));
  DELETE FROM public.tasks WHERE id = _task_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(_search text, _limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, email text, full_name text, created_at timestamptz, credits int,
  banned_at timestamptz, ban_reason text, task_count bigint, unlock_count bigint,
  total_spent_credits bigint, total_paid_eur numeric, is_moderator boolean, is_admin boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT p.id, u.email::text, p.full_name, p.created_at, p.credits, p.banned_at, p.ban_reason,
    (SELECT count(*) FROM public.tasks t WHERE t.user_id = p.id),
    (SELECT count(*) FROM public.task_unlocks tu WHERE tu.user_id = p.id),
    (SELECT COALESCE(-sum(ct.amount), 0) FROM public.credit_transactions ct WHERE ct.user_id = p.id AND ct.amount < 0),
    (SELECT COALESCE(sum(pay.amount_eur), 0) FROM public.payments pay WHERE pay.user_id = p.id AND pay.status = 'completed'),
    public.has_role(p.id, 'moderator'),
    public.has_role(p.id, 'admin')
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE _search IS NULL OR trim(_search) = ''
     OR p.full_name ILIKE '%' || _search || '%'
     OR u.email ILIKE '%' || _search || '%'
  ORDER BY p.created_at DESC
  LIMIT COALESCE(_limit, 50);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'total_tasks', (SELECT count(*) FROM public.tasks),
    'active_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'active'),
    'tasks_7d', (SELECT count(*) FROM public.tasks WHERE created_at > now() - interval '7 days'),
    'tasks_30d', (SELECT count(*) FROM public.tasks WHERE created_at > now() - interval '30 days'),
    'credits_sold', (SELECT COALESCE(sum(credits), 0) FROM public.payments WHERE status = 'completed'),
    'revenue_total', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed'),
    'revenue_7d', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed' AND completed_at > now() - interval '7 days'),
    'revenue_30d', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed' AND completed_at > now() - interval '30 days'),
    'unlocks_total', (SELECT count(*) FROM public.task_unlocks),
    'pending_refunds', (SELECT count(*) FROM public.credit_refund_requests WHERE status = 'pending'),
    'pending_reports', (SELECT count(*) FROM public.task_reports WHERE status = 'pending')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_daily_series()
RETURNS TABLE (day date, signups bigint, tasks bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT d::date,
    (SELECT count(*) FROM public.profiles p WHERE p.created_at::date = d::date),
    (SELECT count(*) FROM public.tasks t WHERE t.created_at::date = d::date)
  FROM generate_series(now()::date - interval '29 days', now()::date, interval '1 day') d
  ORDER BY 1;
END;
$$;

-- 7. SEED FIRST ADMIN
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'ivan@example.bg'
ON CONFLICT DO NOTHING;