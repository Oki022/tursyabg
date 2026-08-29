CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages boolean NOT NULL DEFAULT true,
  tasks boolean NOT NULL DEFAULT true,
  promotions boolean NOT NULL DEFAULT true,
  credits boolean NOT NULL DEFAULT true,
  reviews boolean NOT NULL DEFAULT true,
  moderation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own notification preferences read"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Own notification preferences insert"
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own notification preferences update"
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_set_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notification_group(_type notification_type)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _type
    WHEN 'new_message' THEN 'messages'
    WHEN 'task_expiring' THEN 'tasks'
    WHEN 'task_expired' THEN 'tasks'
    WHEN 'task_still_open' THEN 'tasks'
    WHEN 'task_freshness' THEN 'tasks'
    WHEN 'promo_expiring' THEN 'promotions'
    WHEN 'credits_low' THEN 'credits'
    WHEN 'contact_unlocked' THEN 'credits'
    WHEN 'review_requested' THEN 'reviews'
    WHEN 'review_reminder' THEN 'reviews'
    WHEN 'review_published' THEN 'reviews'
    WHEN 'engagement_claimed' THEN 'reviews'
    WHEN 'engagement_confirmed' THEN 'reviews'
    WHEN 'engagement_rejected' THEN 'reviews'
    WHEN 'engagement_reminder' THEN 'reviews'
    WHEN 'content_approved' THEN 'moderation'
    WHEN 'task_reported' THEN 'moderation'
    ELSE NULL
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.notification_group(notification_type) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_notification(_user_id uuid, _type notification_type, _title text, _body text, _link text, _task_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group text;
  _enabled boolean;
  _id uuid;
BEGIN
  _group := public.notification_group(_type);

  IF _group IS NOT NULL THEN
    SELECT CASE _group
      WHEN 'messages' THEN p.messages
      WHEN 'tasks' THEN p.tasks
      WHEN 'promotions' THEN p.promotions
      WHEN 'credits' THEN p.credits
      WHEN 'reviews' THEN p.reviews
      WHEN 'moderation' THEN p.moderation
    END INTO _enabled
    FROM public.notification_preferences p
    WHERE p.user_id = _user_id;

    IF _enabled IS NOT NULL AND _enabled = false THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, task_id)
  VALUES (_user_id, _type, _title, COALESCE(_body,''), _link, _task_id)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;