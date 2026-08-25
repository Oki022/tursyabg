ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skill_tags text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.profiles_moderate_skills()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v jsonb;
  cats text[] := '{}';
  tags text[] := '{}';
  t text;
BEGIN
  FOREACH t IN ARRAY COALESCE(NEW.skill_categories, '{}') LOOP
    t := left(btrim(t), 60);
    IF t <> '' AND NOT (t = ANY(cats)) AND COALESCE(array_length(cats, 1), 0) < 8 THEN
      cats := cats || t;
    END IF;
  END LOOP;
  NEW.skill_categories := cats;

  FOREACH t IN ARRAY COALESCE(NEW.skill_tags, '{}') LOOP
    t := left(btrim(public.mask_contacts(t)), 30);
    IF t <> '' AND NOT (lower(t) = ANY(SELECT lower(x) FROM unnest(tags) AS x))
       AND COALESCE(array_length(tags, 1), 0) < 10 THEN
      tags := tags || t;
    END IF;
  END LOOP;
  NEW.skill_tags := tags;

  v := public.moderate_text(array_to_string(tags, E'\n'));
  IF (v->>'verdict') = 'block' THEN
    PERFORM public.enqueue_moderation('text', 'profile', NEW.id, NULL, NEW.id, 'high',
      'Блокирано съдържание в уменията', COALESCE(v->>'category', ''), v->>'pattern',
      array_to_string(tags, E'\n'), jsonb_build_object('field', 'skill_tags'));
    RAISE EXCEPTION 'SKILL_TAG_BLOCKED' USING ERRCODE = 'check_violation';
  ELSIF (v->>'verdict') = 'flag' THEN
    PERFORM public.enqueue_moderation('text', 'profile', NEW.id, NULL, NEW.id, 'medium',
      'Съмнително съдържание в уменията', COALESCE(v->>'category', ''), v->>'pattern',
      array_to_string(tags, E'\n'), jsonb_build_object('field', 'skill_tags'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_moderate_skills ON public.profiles;
CREATE TRIGGER trg_profiles_moderate_skills
  BEFORE INSERT OR UPDATE OF skill_categories, skill_tags ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_moderate_skills();

CREATE OR REPLACE FUNCTION public.public_profile(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'city', p.city,
    'created_at', p.created_at, 'completed_jobs', p.completed_jobs,
    'rating_as_pro', p.rating_as_pro, 'review_count_as_pro', p.review_count_as_pro,
    'rating_as_client', p.rating_as_client, 'review_count_as_client', p.review_count_as_client,
    'skill_categories', p.skill_categories, 'skill_tags', p.skill_tags)
  FROM public.profiles p WHERE p.id = _user_id;
$$;