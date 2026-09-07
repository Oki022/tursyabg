-- 1. Credentials: reject contact details instead of masking registry numbers.
CREATE OR REPLACE FUNCTION public.profiles_moderate_credentials()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  item jsonb;
  out_items jsonb := '[]'::jsonb;
  lbl text;
  val text;
  url text;
  blob text := '';
  v jsonb;
BEGIN
  IF NEW.credentials IS NULL OR jsonb_typeof(NEW.credentials) <> 'array' THEN
    NEW.credentials := '[]'::jsonb;
    RETURN NEW;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(NEW.credentials) LOOP
    IF jsonb_typeof(item) <> 'object' THEN CONTINUE; END IF;
    lbl := left(btrim(COALESCE(item->>'label', '')), 60);
    val := left(btrim(COALESCE(item->>'value', '')), 60);
    url := btrim(COALESCE(item->>'url', ''));

    -- Registry identifiers are meant to be looked up, so they are never masked.
    -- Actual contact details are rejected outright with a clear code.
    IF (lbl || ' ' || val) ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,}'
       OR (lbl || ' ' || val) ~ '(\+359|00359)[[:space:]-]*8[0-9][[:space:]-]*[0-9]{3}[[:space:]-]*[0-9]{3}'
       OR (lbl || ' ' || val) ~ '(^|[^0-9])08[7-9][[:space:]-]*[0-9]{3}[[:space:]-]*[0-9]{4}([^0-9]|$)'
       OR (lbl || ' ' || val) ~* '(viber|whatsapp|telegram|messenger|skype|вайбър|вибер|скайп|телеграм)'
    THEN
      RAISE EXCEPTION 'CREDENTIAL_CONTACT' USING ERRCODE = 'check_violation';
    END IF;

    IF url <> '' AND url !~* '^https?://[^[:space:]]{4,200}$' THEN
      url := '';
    END IF;
    IF lbl = '' OR val = '' THEN CONTINUE; END IF;
    IF jsonb_array_length(out_items) >= 5 THEN EXIT; END IF;
    out_items := out_items || jsonb_build_array(
      jsonb_build_object('label', lbl, 'value', val, 'url', NULLIF(left(url, 200), '')));
    blob := blob || lbl || ' ' || val || E'\n';
  END LOOP;

  NEW.credentials := out_items;

  IF btrim(blob) <> '' THEN
    v := public.moderate_text(blob);
    IF (v->>'verdict') = 'block' THEN
      PERFORM public.enqueue_moderation('text', 'profile', NEW.id, NULL, NEW.id, 'high',
        'Блокирано съдържание в публичните регистри', COALESCE(v->>'category', ''), v->>'pattern',
        blob, jsonb_build_object('field', 'credentials'));
      RAISE EXCEPTION 'SKILL_TAG_BLOCKED' USING ERRCODE = 'check_violation';
    ELSIF (v->>'verdict') = 'flag' THEN
      PERFORM public.enqueue_moderation('text', 'profile', NEW.id, NULL, NEW.id, 'normal',
        'Съмнително съдържание в публичните регистри', COALESCE(v->>'category', ''), v->>'pattern',
        blob, jsonb_build_object('field', 'credentials'));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profiles_moderate_credentials() FROM PUBLIC, anon, authenticated;

-- 2. Public profile now exposes the avatar.
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
    'credentials', COALESCE(p.credentials, '[]'::jsonb))
  FROM public.profiles p WHERE p.id = _user_id;
$function$;

-- 3. Contact messages: remember whether the support notification was sent.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- 4. Avatar storage policies.
DROP POLICY IF EXISTS "Avatars are viewable by everyone" ON storage.objects;
CREATE POLICY "Avatars are viewable by everyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload their own avatar" ON storage.objects;
CREATE POLICY "Users upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update their own avatar" ON storage.objects;
CREATE POLICY "Users update their own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete their own avatar" ON storage.objects;
CREATE POLICY "Users delete their own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);