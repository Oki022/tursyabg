DROP FUNCTION IF EXISTS public.feed_tasks(integer, timestamptz, text, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.feed_tasks(_limit integer DEFAULT 20, _cursor timestamp with time zone DEFAULT NULL::timestamp with time zone, _seed text DEFAULT 'seed'::text, _promo_offset integer DEFAULT 0, _category text DEFAULT NULL::text, _city text DEFAULT NULL::text, _neighborhood text DEFAULT NULL::text, _q text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, title text, description text, category text, budget numeric, city text, neighborhood text, status task_status, unlock_cost integer, created_at timestamp with time zone, bumped_at timestamp with time zone, user_id uuid, author text, images text[], is_top boolean, is_urgent boolean, promo_expires_at timestamp with time zone, promoted_slot boolean, unlock_count integer, max_unlocks integer, author_rating numeric, author_review_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT t.* FROM public.tasks t
    WHERE t.status = 'active'
      AND (_category IS NULL OR t.category = _category)
      AND (_city IS NULL OR t.city = _city)
      AND (_neighborhood IS NULL OR t.neighborhood = _neighborhood)
      AND (_q IS NULL OR _q = '' OR t.title ILIKE '%' || _q || '%' OR t.description ILIKE '%' || _q || '%')
  ),
  tops AS (
    SELECT b.*, tp.expires_at AS top_expires FROM base b
    JOIN LATERAL (
      SELECT MAX(p.expires_at) AS expires_at FROM public.task_promotions p
      WHERE p.task_id = b.id AND p.type = 'top' AND p.expires_at > now()
    ) tp ON tp.expires_at IS NOT NULL
  ),
  promoted AS (
    SELECT * FROM tops ORDER BY md5(_seed || tops.id::text)
    LIMIT LEAST(GREATEST(_limit, 1), 4) OFFSET GREATEST(_promo_offset, 0)
  ),
  normal AS (
    SELECT b.* FROM base b
    WHERE NOT EXISTS (SELECT 1 FROM tops t WHERE t.id = b.id)
      AND (_cursor IS NULL OR b.bumped_at < _cursor)
    ORDER BY b.bumped_at DESC LIMIT GREATEST(_limit, 1)
  ),
  combined AS (
    SELECT p.*, true AS promoted_slot, 0 AS ord FROM promoted p
    UNION ALL
    SELECT n.*, NULL::timestamptz AS top_expires, false AS promoted_slot, 1 AS ord FROM normal n
  )
  SELECT c.id, c.title, c.description, c.category, c.budget, c.city, c.neighborhood, c.status,
    c.unlock_cost, c.created_at, c.bumped_at, c.user_id, pr.full_name AS author,
    COALESCE((SELECT array_agg(i.image_url ORDER BY i.sort_order) FROM public.task_images i WHERE i.task_id = c.id), ARRAY[]::text[]) AS images,
    (c.top_expires IS NOT NULL) AS is_top,
    EXISTS (SELECT 1 FROM public.task_promotions u WHERE u.task_id = c.id AND u.type = 'urgent' AND u.expires_at > now()) AS is_urgent,
    c.top_expires AS promo_expires_at, c.promoted_slot, c.unlock_count, c.max_unlocks,
    pr.rating_as_client AS author_rating, pr.review_count_as_client AS author_review_count
  FROM combined c
  LEFT JOIN public.profiles pr ON pr.id = c.user_id
  ORDER BY c.ord, (CASE WHEN c.ord = 0 THEN md5(_seed || c.id::text) ELSE NULL END), c.bumped_at DESC;
$function$;