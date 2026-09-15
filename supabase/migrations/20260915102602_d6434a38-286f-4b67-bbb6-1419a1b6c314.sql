
-- ============ PART 1: merge multiple permissive policies (same role+action) ============

-- tasks SELECT (owner / public active / staff / unlocker)
DROP POLICY IF EXISTS tasks_owner_read ON public.tasks;
DROP POLICY IF EXISTS tasks_public_read_active ON public.tasks;
DROP POLICY IF EXISTS tasks_staff_read ON public.tasks;
DROP POLICY IF EXISTS tasks_unlocker_read ON public.tasks;
CREATE POLICY tasks_read ON public.tasks FOR SELECT TO public
USING (
  ((select auth.uid()) = user_id)
  OR (status = 'active'::task_status AND deleted_at IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = tasks.user_id AND p.banned_at IS NOT NULL))
  OR public.is_staff((select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.task_id = tasks.id AND u.user_id = (select auth.uid()))
);

-- tasks UPDATE (owner / staff)
DROP POLICY IF EXISTS tasks_owner_update ON public.tasks;
DROP POLICY IF EXISTS tasks_staff_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id OR public.is_staff((select auth.uid())))
WITH CHECK ((select auth.uid()) = user_id OR public.is_staff((select auth.uid())));

-- tasks DELETE (owner / admin)
DROP POLICY IF EXISTS tasks_owner_delete ON public.tasks;
DROP POLICY IF EXISTS tasks_admin_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id OR public.has_role((select auth.uid()), 'admin'::app_role));

-- task_images SELECT (public/owner / staff / unlocker) — the owner-write ALL policy stays as is
DROP POLICY IF EXISTS task_images_read ON public.task_images;
DROP POLICY IF EXISTS task_images_staff_read ON public.task_images;
DROP POLICY IF EXISTS task_images_unlocker_read ON public.task_images;
CREATE POLICY task_images_read ON public.task_images FOR SELECT TO public
USING (
  EXISTS (SELECT 1 FROM public.tasks t
          WHERE t.id = task_images.task_id
            AND (t.status = 'active'::task_status OR t.user_id = (select auth.uid())))
  OR public.is_staff((select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.task_id = task_images.task_id AND u.user_id = (select auth.uid()))
);

-- profiles SELECT
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
DROP POLICY IF EXISTS profiles_staff_read ON public.profiles;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
USING ((select auth.uid()) = id OR public.is_staff((select auth.uid())));

-- profile_contacts SELECT
DROP POLICY IF EXISTS profile_contacts_self ON public.profile_contacts;
DROP POLICY IF EXISTS profile_contacts_unlocked_read ON public.profile_contacts;
CREATE POLICY profile_contacts_read ON public.profile_contacts FOR SELECT TO authenticated
USING (
  (select auth.uid()) = user_id
  OR EXISTS (
    SELECT 1 FROM public.task_unlocks u
    JOIN public.tasks t ON t.id = u.task_id
    WHERE u.user_id = (select auth.uid())
      AND t.user_id = profile_contacts.user_id
      AND u.expires_at > now())
);

-- credit_transactions SELECT
DROP POLICY IF EXISTS credit_transactions_own_read ON public.credit_transactions;
DROP POLICY IF EXISTS credit_transactions_staff_read ON public.credit_transactions;
CREATE POLICY credit_transactions_read ON public.credit_transactions FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id OR public.is_staff((select auth.uid())));

-- payments SELECT
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS payments_staff_read ON public.payments;
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id OR public.is_staff((select auth.uid())));

-- task_unlocks SELECT
DROP POLICY IF EXISTS task_unlocks_own_read ON public.task_unlocks;
DROP POLICY IF EXISTS task_unlocks_staff_read ON public.task_unlocks;
CREATE POLICY task_unlocks_read ON public.task_unlocks FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id OR public.is_staff((select auth.uid())));

-- task_reports SELECT
DROP POLICY IF EXISTS task_reports_own_read ON public.task_reports;
DROP POLICY IF EXISTS task_reports_staff_read ON public.task_reports;
CREATE POLICY task_reports_read ON public.task_reports FOR SELECT TO authenticated
USING ((select auth.uid()) = reporter_id OR public.is_staff((select auth.uid())));

-- task_history SELECT
DROP POLICY IF EXISTS task_history_owner_read ON public.task_history;
DROP POLICY IF EXISTS task_history_staff_read ON public.task_history;
CREATE POLICY task_history_read ON public.task_history FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_history.task_id AND t.user_id = (select auth.uid()))
  OR public.is_staff((select auth.uid()))
);

-- task_promotions SELECT
DROP POLICY IF EXISTS task_promotions_active_read ON public.task_promotions;
DROP POLICY IF EXISTS task_promotions_owner_read ON public.task_promotions;
CREATE POLICY task_promotions_read ON public.task_promotions FOR SELECT TO anon, authenticated
USING (expires_at > now() OR (select auth.uid()) = user_id);

-- user_roles SELECT
DROP POLICY IF EXISTS user_roles_own_read ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_read ON public.user_roles;
CREATE POLICY user_roles_read ON public.user_roles FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id OR public.has_role((select auth.uid()), 'admin'::app_role));

-- reviews SELECT
DROP POLICY IF EXISTS "Visible reviews are public" ON public.reviews;
DROP POLICY IF EXISTS "Authors read own reviews" ON public.reviews;
CREATE POLICY reviews_read ON public.reviews FOR SELECT TO anon, authenticated
USING (
  (is_visible = true AND hidden_at IS NULL)
  OR (select auth.uid()) = reviewer_id
  OR public.is_staff((select auth.uid()))
);

-- content_violations SELECT
DROP POLICY IF EXISTS "own violations" ON public.content_violations;
DROP POLICY IF EXISTS "staff violations" ON public.content_violations;
CREATE POLICY content_violations_read ON public.content_violations FOR SELECT TO authenticated
USING (user_id = (select auth.uid()) OR public.is_staff((select auth.uid())));

-- ============ PART 2: wrap remaining auth.*() calls in a scalar subquery ============
DO $do$
DECLARE
  r record;
  q text;
  c text;
  oq text;
  oc text;
  role_list text;
  cmd_txt text;
  stmt text;
BEGIN
  FOR r IN SELECT * FROM pg_policies WHERE schemaname = 'public' LOOP
    oq := r.qual; oc := r.with_check;
    q := oq; c := oc;

    -- normalise already-wrapped calls first so the rewrite is idempotent
    FOREACH cmd_txt IN ARRAY ARRAY['uid','jwt','role','email'] LOOP
      q := replace(q, '( SELECT auth.' || cmd_txt || '() AS ' || cmd_txt || ')', 'auth.' || cmd_txt || '()');
      c := replace(c, '( SELECT auth.' || cmd_txt || '() AS ' || cmd_txt || ')', 'auth.' || cmd_txt || '()');
      q := replace(q, 'auth.' || cmd_txt || '()', '(select auth.' || cmd_txt || '())');
      c := replace(c, 'auth.' || cmd_txt || '()', '(select auth.' || cmd_txt || '())');
    END LOOP;

    IF q IS NOT DISTINCT FROM oq AND c IS NOT DISTINCT FROM oc THEN
      CONTINUE;
    END IF;

    SELECT string_agg(quote_ident(x), ', ') INTO role_list FROM unnest(r.roles) AS x;
    cmd_txt := r.cmd;

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);

    stmt := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
                   r.policyname, r.tablename,
                   CASE WHEN r.permissive = 'RESTRICTIVE' THEN 'RESTRICTIVE' ELSE 'PERMISSIVE' END,
                   cmd_txt, role_list);
    IF q IS NOT NULL THEN stmt := stmt || format(' USING (%s)', q); END IF;
    IF c IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', c); END IF;

    EXECUTE stmt;
  END LOOP;
END
$do$;
