CREATE OR REPLACE FUNCTION public.popular_skill_tags(p_categories text[] DEFAULT NULL, p_limit int DEFAULT 24)
RETURNS TABLE(tag text, uses bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.tag, count(*) AS uses
  FROM public.profiles p
  CROSS JOIN LATERAL unnest(COALESCE(p.skill_tags, '{}')) AS t(tag)
  WHERE btrim(t.tag) <> ''
    AND (
      p_categories IS NULL
      OR array_length(p_categories, 1) IS NULL
      OR COALESCE(p.skill_categories, '{}') && p_categories
    )
  GROUP BY t.tag
  ORDER BY count(*) DESC, t.tag ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.popular_skill_tags(text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.popular_skill_tags(text[], int) TO authenticated;