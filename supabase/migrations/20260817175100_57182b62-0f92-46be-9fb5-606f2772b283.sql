CREATE OR REPLACE FUNCTION public.record_image_moderation(_image_id uuid, _status text, _score numeric,
  _labels jsonb, _provider text, _unavailable boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _task uuid; _owner uuid; _title text; _cat text;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  IF _status NOT IN ('approved','pending') THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS'); END IF;

  SELECT i.task_id, t.user_id, t.title INTO _task, _owner, _title
    FROM public.task_images i JOIN public.tasks t ON t.id = i.task_id WHERE i.id = _image_id;
  IF _task IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF _owner <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;

  UPDATE public.task_images
    SET moderation_status = _status, moderation_score = _score,
        moderation_labels = COALESCE(_labels, '{}'::jsonb), moderation_provider = _provider
    WHERE id = _image_id;

  IF _status = 'pending' THEN
    SELECT COALESCE(_labels->>'category', 'other') INTO _cat;
    UPDATE public.tasks SET status = 'pending' WHERE id = _task AND status = 'active';
    PERFORM public.enqueue_moderation('image', 'task_image', _image_id, _task, _owner,
      CASE WHEN COALESCE(_unavailable, false) THEN 'low' ELSE 'high' END,
      CASE WHEN COALESCE(_unavailable, false)
        THEN 'Автоматичната проверка е недостъпна — задържано за ръчен преглед'
        ELSE 'Съмнително изображение (автоматична проверка)' END,
      _cat, NULL, COALESCE(_title, ''),
      jsonb_build_object('score', _score, 'labels', COALESCE(_labels, '{}'::jsonb),
        'provider', _provider, 'unavailable', COALESCE(_unavailable, false),
        'trust', public.user_trust(_owner)));
    PERFORM public.push_notification(_owner, 'content_held', 'Снимката ти чака преглед',
      'Проверяваме снимка към „' || COALESCE(_title, 'задачата') || '“. Задачата ще стане видима след одобрение.',
      '/profile', _task);
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE EXECUTE ON FUNCTION public.record_image_moderation(uuid, text, numeric, jsonb, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_moderation_queue(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_moderation(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_content_violation(uuid, text, uuid, text, text, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ban_user_cascade(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_moderation(text, text, uuid, uuid, uuid, text, text, text, text, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moderate_text(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_trust(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.needs_prepublish_review(uuid) FROM anon;