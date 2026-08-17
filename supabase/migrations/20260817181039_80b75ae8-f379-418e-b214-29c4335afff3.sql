CREATE OR REPLACE FUNCTION public.close_task(_task_id uuid, _outcome text DEFAULT 'external')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _owner uuid;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  IF _outcome NOT IN ('external','cancelled') THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_OUTCOME'); END IF;
  SELECT user_id INTO _owner FROM public.tasks WHERE id = _task_id;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _owner <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  UPDATE public.tasks
     SET status = CASE WHEN _outcome = 'cancelled' THEN 'inactive'::task_status ELSE 'assigned'::task_status END,
         assigned_at = CASE WHEN _outcome = 'cancelled' THEN assigned_at ELSE now() END
   WHERE id = _task_id;
  RETURN jsonb_build_object('ok', true, 'outcome', _outcome);
END; $function$;

CREATE OR REPLACE FUNCTION public.assign_engagement(_task_id uuid, _professional_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _owner uuid; _title text; _id uuid; _deadline timestamptz;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT user_id, title INTO _owner, _title FROM public.tasks WHERE id = _task_id;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _owner <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF _professional_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.task_unlocks WHERE task_id = _task_id AND user_id = _professional_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_UNLOCKED');
  END IF;
  IF EXISTS (SELECT 1 FROM public.engagements WHERE task_id = _task_id AND professional_id = _professional_id AND status = 'confirmed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  _deadline := now() + interval '14 days';
  INSERT INTO public.engagements (task_id, client_id, professional_id, status, confirmed_at, review_deadline)
  VALUES (_task_id, _me, _professional_id, 'confirmed', now(), _deadline)
  ON CONFLICT (task_id, professional_id) DO UPDATE
    SET status = 'confirmed', confirmed_at = now(), review_deadline = _deadline
  RETURNING id INTO _id;

  UPDATE public.profiles SET completed_jobs = completed_jobs + 1 WHERE id = _professional_id;

  UPDATE public.tasks SET status = 'assigned', assigned_at = now()
   WHERE id = _task_id AND status <> 'assigned';

  PERFORM public.push_notification(_professional_id, 'engagement_confirmed', 'Клиентът те посочи като изпълнител',
    'Остави отзив за „' || COALESCE(_title,'задачата') || '“ в следващите 14 дни.', '/review/' || _id::text, _task_id);
  PERFORM public.push_notification(_me, 'review_requested', 'Остави отзив',
    'Разкажи как мина работата по „' || COALESCE(_title,'задачата') || '“.', '/review/' || _id::text, _task_id);

  RETURN jsonb_build_object('ok', true, 'engagement_id', _id);
END; $function$;

DROP FUNCTION IF EXISTS public.task_unlockers(uuid);
CREATE OR REPLACE FUNCTION public.task_unlockers(_task_id uuid)
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, unlocked_at timestamp with time zone, rating_as_pro numeric, review_count_as_pro integer, has_engagement boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.user_id, p.full_name, p.avatar_url, u.unlocked_at, p.rating_as_pro, p.review_count_as_pro,
    EXISTS (SELECT 1 FROM public.engagements e WHERE e.task_id = _task_id AND e.professional_id = u.user_id AND e.status = 'confirmed')
  FROM public.task_unlocks u
  JOIN public.profiles p ON p.id = u.user_id
  WHERE u.task_id = _task_id
    AND auth.uid() IS NOT NULL
    AND (SELECT t.user_id FROM public.tasks t WHERE t.id = _task_id) = auth.uid()
  ORDER BY u.unlocked_at;
$function$;