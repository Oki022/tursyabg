CREATE OR REPLACE FUNCTION public.respond_engagement(_engagement_id uuid, _confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    UPDATE public.tasks SET status = 'assigned', assigned_at = now()
     WHERE id = e.task_id AND status <> 'assigned';

    PERFORM public.suppress_task_lifecycle_notifications(e.task_id);

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
END; $function$;

DROP FUNCTION IF EXISTS public.my_engagements();

CREATE OR REPLACE FUNCTION public.my_engagements()
 RETURNS TABLE(id uuid, task_id uuid, task_title text, task_category text, status engagement_status, client_id uuid, professional_id uuid, client_name text, professional_name text, claimed_at timestamp with time zone, confirmed_at timestamp with time zone, review_deadline timestamp with time zone, my_review_id uuid, other_submitted boolean, task_status task_status, promo_expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id, e.task_id, t.title, t.category, e.status, e.client_id, e.professional_id,
    pc.full_name, pp.full_name, e.claimed_at, e.confirmed_at, e.review_deadline,
    (SELECT r.id FROM public.reviews r WHERE r.engagement_id = e.id AND r.reviewer_id = auth.uid()),
    EXISTS (SELECT 1 FROM public.reviews r WHERE r.engagement_id = e.id AND r.reviewer_id <> auth.uid()),
    t.status,
    (SELECT max(tp.expires_at) FROM public.task_promotions tp WHERE tp.task_id = e.task_id AND tp.expires_at > now())
  FROM public.engagements e
  JOIN public.tasks t ON t.id = e.task_id
  LEFT JOIN public.profiles pc ON pc.id = e.client_id
  LEFT JOIN public.profiles pp ON pp.id = e.professional_id
  WHERE auth.uid() IS NOT NULL AND (e.client_id = auth.uid() OR e.professional_id = auth.uid())
  ORDER BY e.claimed_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.my_engagements() TO authenticated;