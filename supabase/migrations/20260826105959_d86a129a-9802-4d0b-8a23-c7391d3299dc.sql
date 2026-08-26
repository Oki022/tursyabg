-- 1. profiles: restrict full-row reads to owner/staff, expose safe fields via a view
DROP POLICY IF EXISTS profiles_public_read ON public.profiles;

CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_staff_read ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT id, full_name, avatar_url, city, neighborhood,
         rating_as_pro, review_count_as_pro,
         rating_as_client, review_count_as_client,
         completed_jobs, skill_categories, skill_tags, created_at
  FROM public.profiles;

ALTER VIEW public.profiles_public SET (security_invoker = false);
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 2. messages insert: authenticated only
DROP POLICY IF EXISTS messages_sender_insert ON public.messages;
CREATE POLICY messages_sender_insert ON public.messages
  FOR INSERT TO authenticated
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

-- 3. tasks unlocker read: authenticated only
DROP POLICY IF EXISTS tasks_unlocker_read ON public.tasks;
CREATE POLICY tasks_unlocker_read ON public.tasks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.task_id = tasks.id AND u.user_id = auth.uid()));

-- 4. task_promotions: hide price_paid_eur from clients, allow owners to read own rows
REVOKE SELECT ON public.task_promotions FROM anon, authenticated;
GRANT SELECT (id, task_id, user_id, promo_product_id, type, starts_at, expires_at, created_at)
  ON public.task_promotions TO anon, authenticated;

DROP POLICY IF EXISTS task_promotions_owner_read ON public.task_promotions;
CREATE POLICY task_promotions_owner_read ON public.task_promotions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5. task images: unlockers keep access to images of tasks they paid for
DROP POLICY IF EXISTS task_images_unlocker_read ON public.task_images;
CREATE POLICY task_images_unlocker_read ON public.task_images
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.task_unlocks u
    WHERE u.task_id = task_images.task_id AND u.user_id = auth.uid()));

-- 6. storage: stop blanket public read of the private task-images bucket
DROP POLICY IF EXISTS task_images_read_all ON storage.objects;
CREATE POLICY task_images_read_scoped ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'task-images'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.task_images ti
        WHERE ti.image_url = storage.objects.name
      )
    )
  );

-- 7. internal SECURITY DEFINER routines: not callable by API roles
REVOKE ALL ON FUNCTION public.my_engagements() FROM anon;
REVOKE ALL ON FUNCTION public.profiles_moderate_skills() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_trust(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reveal_engagement_reviews(uuid) FROM PUBLIC, anon, authenticated;
