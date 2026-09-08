CREATE OR REPLACE FUNCTION public.admin_contact_sender(_user_id uuid, _email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
  _res jsonb;
  _mail text := lower(trim(coalesce(_email, '')));
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL OR NOT (
    public.has_role(_caller, 'admin'::public.app_role)
    OR public.has_role(_caller, 'moderator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;

  _id := _user_id;

  IF _id IS NULL AND _mail <> '' THEN
    SELECT u.id INTO _id
    FROM auth.users u
    WHERE lower(trim(u.email)) = _mail
    ORDER BY u.created_at
    LIMIT 1;
  END IF;

  IF _id IS NULL AND _mail <> '' THEN
    SELECT i.user_id INTO _id
    FROM auth.identities i
    WHERE lower(trim(coalesce(i.identity_data ->> 'email', ''))) = _mail
    ORDER BY i.created_at
    LIMIT 1;
  END IF;

  IF _id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'found', true,
    'id', p.id,
    'full_name', p.full_name,
    'created_at', p.created_at,
    'credits', p.credits,
    'rating_as_pro', p.rating_as_pro,
    'review_count_as_pro', p.review_count_as_pro,
    'rating_as_client', p.rating_as_client,
    'review_count_as_client', p.review_count_as_client,
    'completed_jobs', p.completed_jobs,
    'banned_at', p.banned_at,
    'suspended_until', p.suspended_until,
    'task_count', (SELECT count(*) FROM public.tasks t WHERE t.user_id = p.id),
    'violation_count', (SELECT count(*) FROM public.content_violations cv
                         WHERE cv.user_id = p.id AND cv.reverted_at IS NULL)
  )
  INTO _res
  FROM public.profiles p
  WHERE p.id = _id;

  RETURN coalesce(_res, jsonb_build_object('found', true, 'id', _id));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_contact_sender(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_contact_sender(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_contact_sender(uuid, text) TO service_role;