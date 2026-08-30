CREATE OR REPLACE FUNCTION public.public_profile(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'city', p.city,
    'neighborhood', p.neighborhood,
    'created_at', p.created_at, 'completed_jobs', p.completed_jobs,
    'rating_as_pro', p.rating_as_pro, 'review_count_as_pro', p.review_count_as_pro,
    'rating_as_client', p.rating_as_client, 'review_count_as_client', p.review_count_as_client,
    'skill_categories', p.skill_categories, 'skill_tags', p.skill_tags)
  FROM public.profiles p WHERE p.id = _user_id;
$function$;