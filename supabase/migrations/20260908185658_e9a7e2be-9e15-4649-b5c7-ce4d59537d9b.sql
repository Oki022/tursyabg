CREATE OR REPLACE FUNCTION public.profile_has_activity(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.tasks t WHERE t.user_id = _user_id AND t.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.task_unlocks u WHERE u.user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.reviews r WHERE r.reviewee_id = _user_id AND r.is_visible AND r.hidden_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND COALESCE(p.completed_jobs, 0) > 0);
$function$;

REVOKE ALL ON FUNCTION public.profile_has_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_has_activity(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.public_profile(_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'city', p.city,
    'avatar_url', p.avatar_url,
    'neighborhood', p.neighborhood,
    'created_at', p.created_at, 'completed_jobs', p.completed_jobs,
    'rating_as_pro', p.rating_as_pro, 'review_count_as_pro', p.review_count_as_pro,
    'rating_as_client', p.rating_as_client, 'review_count_as_client', p.review_count_as_client,
    'skill_categories', p.skill_categories, 'skill_tags', p.skill_tags,
    'has_activity', public.profile_has_activity(p.id),
    'credentials', COALESCE(p.credentials, '[]'::jsonb))
  FROM public.profiles p WHERE p.id = _user_id;
$function$;

DROP FUNCTION IF EXISTS public.public_profiles(uuid[]);
CREATE FUNCTION public.public_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, full_name text, avatar_url text, city text, neighborhood text, rating_as_pro numeric, review_count_as_pro integer, rating_as_client numeric, review_count_as_client integer, completed_jobs integer, skill_categories text[], skill_tags text[], created_at timestamp with time zone, has_activity boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.avatar_url, p.city, p.neighborhood,
         p.rating_as_pro, p.review_count_as_pro,
         p.rating_as_client, p.review_count_as_client,
         p.completed_jobs, p.skill_categories, p.skill_tags, p.created_at,
         public.profile_has_activity(p.id) AS has_activity
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
$function$;

REVOKE ALL ON FUNCTION public.public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_profiles(uuid[]) TO anon, authenticated, service_role;