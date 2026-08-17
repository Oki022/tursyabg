-- ENUMS
CREATE TYPE public.engagement_status AS ENUM ('claimed','confirmed','rejected','expired');
CREATE TYPE public.review_direction AS ENUM ('client_to_pro','pro_to_client');

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'engagement_claimed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'engagement_confirmed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'engagement_rejected';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'engagement_reminder';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_reminder';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_published';

-- PROFILE AGGREGATES
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating_as_pro numeric,
  ADD COLUMN IF NOT EXISTS review_count_as_pro integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_as_client numeric,
  ADD COLUMN IF NOT EXISTS review_count_as_client integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_jobs integer NOT NULL DEFAULT 0;

-- ENGAGEMENTS
CREATE TABLE public.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.engagement_status NOT NULL DEFAULT 'claimed',
  claimed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  review_deadline timestamptz,
  reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagements_distinct_parties CHECK (client_id <> professional_id),
  CONSTRAINT engagements_task_pro_unique UNIQUE (task_id, professional_id)
);
CREATE INDEX engagements_client_status_idx ON public.engagements (client_id, status);
CREATE INDEX engagements_pro_status_idx ON public.engagements (professional_id, status);

GRANT SELECT ON public.engagements TO authenticated;
GRANT ALL ON public.engagements TO service_role;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read engagements" ON public.engagements
  FOR SELECT TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = professional_id OR public.is_staff(auth.uid()));

-- REVIEWS
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction public.review_direction NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(comment) BETWEEN 10 AND 1000),
  is_visible boolean NOT NULL DEFAULT false,
  hidden_at timestamptz,
  hidden_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_no_self CHECK (reviewer_id <> reviewee_id),
  CONSTRAINT reviews_one_per_person UNIQUE (engagement_id, reviewer_id)
);
CREATE INDEX reviews_reviewee_idx ON public.reviews (reviewee_id, is_visible, created_at DESC);
CREATE INDEX reviews_reviewer_idx ON public.reviews (reviewer_id);

GRANT SELECT ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible reviews are public" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (is_visible = true AND hidden_at IS NULL);

CREATE POLICY "Authors read own reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = reviewer_id OR public.is_staff(auth.uid()));

-- REVIEW REPORTS
CREATE TABLE public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason public.report_reason NOT NULL,
  details text NOT NULL DEFAULT '',
  status public.report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_reports_unique UNIQUE (review_id, reporter_id)
);
GRANT SELECT, INSERT ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters read own review reports" ON public.review_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.is_staff(auth.uid()));

CREATE POLICY "Users report reviews" ON public.review_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- MASK CONTACTS IN REVIEW COMMENTS
CREATE OR REPLACE FUNCTION public.reviews_mask_contacts()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.comment := public.mask_contacts(NEW.comment);
  RETURN NEW;
END; $$;

CREATE TRIGGER reviews_mask_contacts_trg BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_mask_contacts();

-- AGGREGATES
CREATE OR REPLACE FUNCTION public.recompute_review_aggregates(_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.profiles p SET
    rating_as_pro = (SELECT round(avg(r.rating)::numeric, 2) FROM public.reviews r
      WHERE r.reviewee_id = _user_id AND r.direction = 'client_to_pro' AND r.is_visible AND r.hidden_at IS NULL),
    review_count_as_pro = (SELECT count(*) FROM public.reviews r
      WHERE r.reviewee_id = _user_id AND r.direction = 'client_to_pro' AND r.is_visible AND r.hidden_at IS NULL),
    rating_as_client = (SELECT round(avg(r.rating)::numeric, 2) FROM public.reviews r
      WHERE r.reviewee_id = _user_id AND r.direction = 'pro_to_client' AND r.is_visible AND r.hidden_at IS NULL),
    review_count_as_client = (SELECT count(*) FROM public.reviews r
      WHERE r.reviewee_id = _user_id AND r.direction = 'pro_to_client' AND r.is_visible AND r.hidden_at IS NULL)
  WHERE p.id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.reviews_sync_aggregates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recompute_review_aggregates(NEW.reviewee_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER reviews_sync_aggregates_trg AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_sync_aggregates();

-- REVEAL HELPER
CREATE OR REPLACE FUNCTION public.reveal_engagement_reviews(_engagement_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _r record; _n int := 0;
BEGIN
  FOR _r IN SELECT * FROM public.reviews WHERE engagement_id = _engagement_id AND is_visible = false LOOP
    UPDATE public.reviews SET is_visible = true WHERE id = _r.id;
    PERFORM public.push_notification(_r.reviewee_id, 'review_published', 'Получи нов отзив',
      'Отзивът за теб вече е публичен.', '/user/' || _r.reviewee_id::text, _r.task_id);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;

-- CLAIM (professional)
CREATE OR REPLACE FUNCTION public.claim_engagement(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _task record; _id uuid; _name text;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT id, user_id, title INTO _task FROM public.tasks WHERE id = _task_id;
  IF _task.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _task.user_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'OWN_TASK'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.task_unlocks WHERE task_id = _task_id AND user_id = _me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_UNLOCKED');
  END IF;
  IF EXISTS (SELECT 1 FROM public.engagements WHERE task_id = _task_id AND professional_id = _me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  INSERT INTO public.engagements (task_id, client_id, professional_id, status)
  VALUES (_task_id, _task.user_id, _me, 'claimed') RETURNING id INTO _id;

  SELECT COALESCE(full_name, 'Изпълнител') INTO _name FROM public.profiles WHERE id = _me;
  PERFORM public.push_notification(_task.user_id, 'engagement_claimed', 'Потвърди изпълнителя си',
    _name || ' твърди, че е свършил „' || _task.title || '“. Вярно ли е?',
    '/task/' || _task_id::text, _task_id);

  RETURN jsonb_build_object('ok', true, 'engagement_id', _id);
END; $$;

-- CLIENT RESPONDS
CREATE OR REPLACE FUNCTION public.respond_engagement(_engagement_id uuid, _confirm boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); e public.engagements%ROWTYPE; _title text; _deadline timestamptz;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT * INTO e FROM public.engagements WHERE id = _engagement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF e.client_id <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF e.status <> 'claimed' THEN RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_RESOLVED'); END IF;

  SELECT title INTO _title FROM public.tasks WHERE id = e.task_id;

  IF _confirm THEN
    _deadline := now() + interval '14 days';
    UPDATE public.engagements SET status = 'confirmed', confirmed_at = now(), review_deadline = _deadline
      WHERE id = e.id;
    UPDATE public.profiles SET completed_jobs = completed_jobs + 1 WHERE id = e.professional_id;
    PERFORM public.push_notification(e.professional_id, 'engagement_confirmed', 'Задачата е потвърдена',
      'Клиентът потвърди, че си свършил „' || COALESCE(_title,'задачата') || '“. Остави отзив в следващите 14 дни.',
      '/review/' || e.id::text, e.task_id);
    PERFORM public.push_notification(e.client_id, 'review_requested', 'Остави отзив',
      'Разкажи как мина работата по „' || COALESCE(_title,'задачата') || '“.',
      '/review/' || e.id::text, e.task_id);
  ELSE
    UPDATE public.engagements SET status = 'rejected' WHERE id = e.id;
    PERFORM public.push_notification(e.professional_id, 'engagement_rejected', 'Заявката ти беше отхвърлена',
      'Клиентът не потвърди, че си изпълнил „' || COALESCE(_title,'задачата') || '“.',
      '/unlocked', e.task_id);
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $$;

-- CLIENT ASSIGNS DIRECTLY (pre-confirmed)
CREATE OR REPLACE FUNCTION public.assign_engagement(_task_id uuid, _professional_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _owner uuid; _title text; _id uuid; _deadline timestamptz;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT user_id, title INTO _owner, _title FROM public.tasks WHERE id = _task_id;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _owner <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF _professional_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.task_unlocks WHERE task_id = _task_id AND user_id = _professional_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_UNLOCKED');
  END IF;

  _deadline := now() + interval '14 days';
  INSERT INTO public.engagements (task_id, client_id, professional_id, status, confirmed_at, review_deadline)
  VALUES (_task_id, _me, _professional_id, 'confirmed', now(), _deadline)
  ON CONFLICT (task_id, professional_id) DO UPDATE
    SET status = 'confirmed', confirmed_at = now(), review_deadline = _deadline
  RETURNING id INTO _id;

  UPDATE public.profiles SET completed_jobs = completed_jobs + 1 WHERE id = _professional_id;

  PERFORM public.push_notification(_professional_id, 'engagement_confirmed', 'Клиентът те посочи като изпълнител',
    'Остави отзив за „' || COALESCE(_title,'задачата') || '“ в следващите 14 дни.', '/review/' || _id::text, _task_id);
  PERFORM public.push_notification(_me, 'review_requested', 'Остави отзив',
    'Разкажи как мина работата по „' || COALESCE(_title,'задачата') || '“.', '/review/' || _id::text, _task_id);

  RETURN jsonb_build_object('ok', true, 'engagement_id', _id);
END; $$;

-- SUBMIT REVIEW
CREATE OR REPLACE FUNCTION public.submit_review(_engagement_id uuid, _rating integer, _comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); e public.engagements%ROWTYPE;
  _dir public.review_direction; _reviewee uuid; _other_exists boolean; _revealed boolean := false;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RATING'); END IF;
  IF _comment IS NULL OR char_length(trim(_comment)) < 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_TOO_SHORT'); END IF;
  IF char_length(_comment) > 1000 THEN RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_TOO_LONG'); END IF;

  SELECT * INTO e FROM public.engagements WHERE id = _engagement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF e.status <> 'confirmed' THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_CONFIRMED'); END IF;
  IF e.review_deadline < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'WINDOW_CLOSED'); END IF;

  IF _me = e.client_id THEN _dir := 'client_to_pro'; _reviewee := e.professional_id;
  ELSIF _me = e.professional_id THEN _dir := 'pro_to_client'; _reviewee := e.client_id;
  ELSE RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;

  IF EXISTS (SELECT 1 FROM public.reviews WHERE engagement_id = e.id AND reviewer_id = _me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DUPLICATE');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.reviews WHERE engagement_id = e.id) INTO _other_exists;

  INSERT INTO public.reviews (engagement_id, task_id, reviewer_id, reviewee_id, direction, rating, comment)
  VALUES (e.id, e.task_id, _me, _reviewee, _dir, _rating, trim(_comment));

  IF _other_exists THEN
    PERFORM public.reveal_engagement_reviews(e.id);
    _revealed := true;
  END IF;

  RETURN jsonb_build_object('ok', true, 'revealed', _revealed);
END; $$;

-- PENDING WORK FOR CURRENT USER
CREATE OR REPLACE FUNCTION public.my_engagements()
RETURNS TABLE(id uuid, task_id uuid, task_title text, task_category text, status public.engagement_status,
  client_id uuid, professional_id uuid, client_name text, professional_name text,
  claimed_at timestamptz, confirmed_at timestamptz, review_deadline timestamptz, my_review_id uuid, other_submitted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT e.id, e.task_id, t.title, t.category, e.status, e.client_id, e.professional_id,
    pc.full_name, pp.full_name, e.claimed_at, e.confirmed_at, e.review_deadline,
    (SELECT r.id FROM public.reviews r WHERE r.engagement_id = e.id AND r.reviewer_id = auth.uid()),
    EXISTS (SELECT 1 FROM public.reviews r WHERE r.engagement_id = e.id AND r.reviewer_id <> auth.uid())
  FROM public.engagements e
  JOIN public.tasks t ON t.id = e.task_id
  LEFT JOIN public.profiles pc ON pc.id = e.client_id
  LEFT JOIN public.profiles pp ON pp.id = e.professional_id
  WHERE auth.uid() IS NOT NULL AND (e.client_id = auth.uid() OR e.professional_id = auth.uid())
  ORDER BY e.claimed_at DESC;
$$;

-- PUBLIC PROFILE + REVIEWS
CREATE OR REPLACE FUNCTION public.public_profile(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'city', p.city,
    'created_at', p.created_at, 'completed_jobs', p.completed_jobs,
    'rating_as_pro', p.rating_as_pro, 'review_count_as_pro', p.review_count_as_pro,
    'rating_as_client', p.rating_as_client, 'review_count_as_client', p.review_count_as_client)
  FROM public.profiles p WHERE p.id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.public_reviews(_user_id uuid, _direction public.review_direction, _limit integer DEFAULT 10, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, rating integer, comment text, created_at timestamptz, category text, reviewer_id uuid, reviewer_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.id, r.rating, r.comment, r.created_at, t.category, r.reviewer_id, pr.full_name
  FROM public.reviews r
  JOIN public.tasks t ON t.id = r.task_id
  LEFT JOIN public.profiles pr ON pr.id = r.reviewer_id
  WHERE r.reviewee_id = _user_id AND r.direction = _direction AND r.is_visible AND r.hidden_at IS NULL
  ORDER BY r.created_at DESC
  LIMIT GREATEST(COALESCE(_limit, 10), 1) OFFSET GREATEST(COALESCE(_offset, 0), 0);
$$;

-- CANDIDATES FOR "who got the job"
CREATE OR REPLACE FUNCTION public.task_unlockers(_task_id uuid)
RETURNS TABLE(user_id uuid, full_name text, unlocked_at timestamptz, rating_as_pro numeric, review_count_as_pro integer, has_engagement boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT u.user_id, p.full_name, u.unlocked_at, p.rating_as_pro, p.review_count_as_pro,
    EXISTS (SELECT 1 FROM public.engagements e WHERE e.task_id = _task_id AND e.professional_id = u.user_id)
  FROM public.task_unlocks u
  JOIN public.profiles p ON p.id = u.user_id
  WHERE u.task_id = _task_id
    AND auth.uid() IS NOT NULL
    AND (SELECT t.user_id FROM public.tasks t WHERE t.id = _task_id) = auth.uid()
  ORDER BY u.unlocked_at;
$$;

-- ADMIN
CREATE OR REPLACE FUNCTION public.admin_list_reviews(_filter text DEFAULT 'recent', _limit integer DEFAULT 50)
RETURNS TABLE(id uuid, rating integer, comment text, created_at timestamptz, is_visible boolean,
  hidden_at timestamptz, hidden_reason text, direction public.review_direction,
  reviewer_id uuid, reviewer_name text, reviewee_id uuid, reviewee_name text,
  task_id uuid, task_title text, report_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT r.id, r.rating, r.comment, r.created_at, r.is_visible, r.hidden_at, r.hidden_reason, r.direction,
    r.reviewer_id, pr.full_name, r.reviewee_id, pe.full_name, r.task_id, t.title,
    (SELECT count(*) FROM public.review_reports rr WHERE rr.review_id = r.id)
  FROM public.reviews r
  LEFT JOIN public.profiles pr ON pr.id = r.reviewer_id
  LEFT JOIN public.profiles pe ON pe.id = r.reviewee_id
  LEFT JOIN public.tasks t ON t.id = r.task_id
  WHERE CASE
      WHEN _filter = 'reported' THEN EXISTS (SELECT 1 FROM public.review_reports rr WHERE rr.review_id = r.id AND rr.status = 'pending')
      WHEN _filter = 'low' THEN r.rating <= 2
      WHEN _filter = 'hidden' THEN r.hidden_at IS NOT NULL
      ELSE true END
  ORDER BY r.created_at DESC
  LIMIT COALESCE(_limit, 50);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_hide_review(_review_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _reviewee uuid;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED'); END IF;
  UPDATE public.reviews SET hidden_at = now(), hidden_reason = _reason WHERE id = _review_id RETURNING reviewee_id INTO _reviewee;
  IF _reviewee IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  UPDATE public.review_reports SET status = 'reviewed' WHERE review_id = _review_id AND status = 'pending';
  PERFORM public.recompute_review_aggregates(_reviewee);
  PERFORM public.log_admin_action('review_hidden', 'review', _review_id, jsonb_build_object('reason', _reason));
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_flags()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN jsonb_build_object(
    'rejected_claim_users', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT e.professional_id AS user_id, p.full_name, count(*) AS rejected
        FROM public.engagements e LEFT JOIN public.profiles p ON p.id = e.professional_id
        WHERE e.status = 'rejected' AND e.claimed_at > now() - interval '30 days'
        GROUP BY 1, 2 HAVING count(*) >= 3) x),
    'mutual_reviewers', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT r1.reviewer_id AS user_a, r1.reviewee_id AS user_b, count(*) AS pairs
        FROM public.reviews r1
        WHERE EXISTS (SELECT 1 FROM public.reviews r2 WHERE r2.reviewer_id = r1.reviewee_id AND r2.reviewee_id = r1.reviewer_id)
        GROUP BY 1, 2 HAVING count(*) >= 2) x),
    'new_account_five_stars', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT r.reviewer_id AS user_id, p.full_name, count(*) AS five_stars
        FROM public.reviews r JOIN public.profiles p ON p.id = r.reviewer_id
        WHERE r.rating = 5 AND p.created_at > now() - interval '14 days'
        GROUP BY 1, 2 HAVING count(*) >= 3) x),
    'engagements_without_reviews', (
      SELECT count(*) FROM public.engagements e
      WHERE e.status = 'confirmed' AND e.review_deadline < now()
        AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.engagement_id = e.id))
  );
END; $$;

-- SWEEP: expiry + reminders
CREATE OR REPLACE FUNCTION public.sweep_engagements()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e record;
BEGIN
  -- day 3 reminder for pending claims
  FOR e IN SELECT * FROM public.engagements
    WHERE status = 'claimed' AND reminded_at IS NULL AND claimed_at < now() - interval '3 days' LOOP
    PERFORM public.push_notification(e.client_id, 'engagement_reminder', 'Потвърди изпълнителя си',
      'Все още чакаме потвърждение за изпълнителя по задачата ти.', '/task/' || e.task_id::text, e.task_id);
    UPDATE public.engagements SET reminded_at = now() WHERE id = e.id;
  END LOOP;

  -- claims with no answer in 7 days expire
  UPDATE public.engagements SET status = 'expired'
    WHERE status = 'claimed' AND claimed_at < now() - interval '7 days';

  -- review reminders at day 3 and day 10 of the 14-day window
  FOR e IN SELECT * FROM public.engagements
    WHERE status = 'confirmed' AND review_deadline > now()
      AND confirmed_at < now() - interval '3 days' LOOP
    PERFORM public.push_notification(u.uid, 'review_reminder', 'Остави отзив',
      'Имаш още време да оставиш отзив за съвместната работа.', '/review/' || e.id::text, e.task_id)
    FROM (SELECT e.client_id AS uid UNION ALL SELECT e.professional_id) u
    WHERE NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.engagement_id = e.id AND r.reviewer_id = u.uid)
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = u.uid AND n.type = 'review_reminder'
        AND n.task_id = e.task_id AND n.created_at > now() - interval '6 days');
  END LOOP;

  -- deadline passed: reveal whatever exists
  FOR e IN SELECT * FROM public.engagements
    WHERE status = 'confirmed' AND review_deadline <= now()
      AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.engagement_id = e.id AND r.is_visible = false) LOOP
    PERFORM public.reveal_engagement_reviews(e.id);
  END LOOP;
END; $$;