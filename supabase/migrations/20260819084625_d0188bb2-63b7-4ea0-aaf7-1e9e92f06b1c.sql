CREATE OR REPLACE FUNCTION public.finalize_task_publication(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE t public.tasks%ROWTYPE; _blockers int; _images int; _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF t.user_id <> _me AND NOT public.is_staff(_me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF t.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'published', t.status = 'active', 'held', false);
  END IF;

  SELECT count(*) INTO _blockers FROM public.moderation_items m
    WHERE m.task_id = _task_id AND m.status = 'pending'
      AND (m.kind <> 'text' OR COALESCE((m.details->>'auto_eligible')::boolean, false) = false);

  SELECT count(*) INTO _images FROM public.task_images i
    WHERE i.task_id = _task_id AND i.moderation_status <> 'approved';

  IF _blockers > 0 OR _images > 0 THEN
    RETURN jsonb_build_object('ok', true, 'published', false, 'held', true);
  END IF;

  UPDATE public.tasks SET status = 'active', bumped_at = now() WHERE id = _task_id;
  UPDATE public.moderation_items
    SET status = 'approved', resolved_at = now(),
        resolution_reason = 'Автоматично одобрено — всички проверки са чисти'
    WHERE task_id = _task_id AND status = 'pending' AND kind = 'text';

  RETURN jsonb_build_object('ok', true, 'published', true, 'held', false);
END; $function$;

REVOKE ALL ON FUNCTION public.finalize_task_publication(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_task_publication(uuid) TO authenticated;

-- Internal sweep helper: never callable from the Data API.
REVOKE ALL ON FUNCTION public.sweep_autopublish(int) FROM PUBLIC, anon, authenticated;