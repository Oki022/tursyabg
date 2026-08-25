CREATE OR REPLACE FUNCTION public.copy_task_images(_source_task_id uuid, _new_task_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _count int;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = _source_task_id AND user_id = _me)
     OR NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = _new_task_id AND user_id = _me) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.task_images (task_id, image_url, sort_order, moderation_status, moderation_score, moderation_labels, moderation_provider)
  SELECT _new_task_id, image_url, sort_order, moderation_status, moderation_score, moderation_labels, moderation_provider
  FROM public.task_images
  WHERE task_id = _source_task_id AND moderation_status = 'approved'
  ORDER BY sort_order;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.copy_task_images(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_task_images(uuid, uuid) TO authenticated;