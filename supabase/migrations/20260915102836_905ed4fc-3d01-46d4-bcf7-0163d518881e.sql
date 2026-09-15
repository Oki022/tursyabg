
-- tasks
DROP POLICY IF EXISTS tasks_read ON public.tasks;
CREATE POLICY tasks_public_read_active ON public.tasks FOR SELECT TO anon
USING (
  status = 'active'::task_status AND deleted_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = tasks.user_id AND p.banned_at IS NOT NULL)
);
CREATE POLICY tasks_read ON public.tasks FOR SELECT TO authenticated
USING (
  ((select auth.uid()) = user_id)
  OR (status = 'active'::task_status AND deleted_at IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = tasks.user_id AND p.banned_at IS NOT NULL))
  OR public.is_staff((select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.task_id = tasks.id AND u.user_id = (select auth.uid()))
);

-- task_images
DROP POLICY IF EXISTS task_images_read ON public.task_images;
CREATE POLICY task_images_public_read ON public.task_images FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_images.task_id AND t.status = 'active'::task_status));
CREATE POLICY task_images_read ON public.task_images FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tasks t
          WHERE t.id = task_images.task_id
            AND (t.status = 'active'::task_status OR t.user_id = (select auth.uid())))
  OR public.is_staff((select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.task_id = task_images.task_id AND u.user_id = (select auth.uid()))
);

-- reviews
DROP POLICY IF EXISTS reviews_read ON public.reviews;
CREATE POLICY reviews_public_read ON public.reviews FOR SELECT TO anon
USING (is_visible = true AND hidden_at IS NULL);
CREATE POLICY reviews_read ON public.reviews FOR SELECT TO authenticated
USING (
  (is_visible = true AND hidden_at IS NULL)
  OR (select auth.uid()) = reviewer_id
  OR public.is_staff((select auth.uid()))
);

-- task_promotions: anon must not hit any helper; split per role (same rule as before)
DROP POLICY IF EXISTS task_promotions_read ON public.task_promotions;
CREATE POLICY task_promotions_public_read ON public.task_promotions FOR SELECT TO anon
USING (expires_at > now());
CREATE POLICY task_promotions_read ON public.task_promotions FOR SELECT TO authenticated
USING (expires_at > now() OR (select auth.uid()) = user_id);
