DROP VIEW IF EXISTS public.profiles_public;

CREATE OR REPLACE FUNCTION public.public_profiles(_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  city text,
  neighborhood text,
  rating_as_pro numeric,
  review_count_as_pro integer,
  rating_as_client numeric,
  review_count_as_client integer,
  completed_jobs integer,
  skill_categories text[],
  skill_tags text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.city, p.neighborhood,
         p.rating_as_pro, p.review_count_as_pro,
         p.rating_as_client, p.review_count_as_client,
         p.completed_jobs, p.skill_categories, p.skill_tags
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
$$;

REVOKE ALL ON FUNCTION public.public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_profiles(uuid[]) TO anon, authenticated;
