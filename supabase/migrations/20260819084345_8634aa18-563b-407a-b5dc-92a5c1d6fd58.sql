-- 1) Insert trigger: keep new-account first tasks briefly held so images can be
--    checked before anything is visible, but mark WHY it is held.
CREATE OR REPLACE FUNCTION public.tasks_moderate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v jsonb; p record;
BEGIN
  SELECT banned_at, suspended_until INTO p FROM public.profiles WHERE id = NEW.user_id;
  IF p.banned_at IS NOT NULL THEN RAISE EXCEPTION 'ACCOUNT_BANNED'; END IF;
  IF p.suspended_until IS NOT NULL AND p.suspended_until > now() THEN RAISE EXCEPTION 'POSTING_SUSPENDED'; END IF;

  v := public.moderate_text(COALESCE(NEW.title,'') || E'\n' || COALESCE(NEW.description,''));
  IF v->>'verdict' = 'block' THEN
    PERFORM public.record_content_violation(NEW.user_id, 'task', NULL, v->>'category', 'block', true);
    RAISE EXCEPTION 'CONTENT_BLOCKED:%', v->>'category';
  END IF;

  IF v->>'verdict' = 'flag' OR public.needs_prepublish_review(NEW.user_id) THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END; $function$;

-- 2) After trigger: queue the audit item. Notify the author ONLY when the hold
--    is a genuine flag; the new-account hold is resolved automatically seconds
--    later by finalize_task_publication().
CREATE OR REPLACE FUNCTION public.tasks_moderate_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v jsonb; _flagged boolean;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  v := public.moderate_text(COALESCE(NEW.title,'') || E'\n' || COALESCE(NEW.description,''));
  _flagged := (v->>'verdict' = 'flag');

  PERFORM public.enqueue_moderation('text', 'task', NEW.id, NEW.id, NEW.user_id,
    CASE WHEN _flagged THEN 'medium' ELSE 'low' END,
    CASE WHEN _flagged THEN 'Съвпадение с правило за съдържание' ELSE 'Нов профил — автоматична проверка' END,
    COALESCE(v->>'category',''), v->>'pattern',
    COALESCE(NEW.title,'') || ' — ' || COALESCE(NEW.description,''),
    jsonb_build_object('trust', public.user_trust(NEW.user_id), 'auto_eligible', NOT _flagged));

  IF _flagged THEN
    PERFORM public.push_notification(NEW.user_id, 'content_held', 'Задачата ти се проверява',
      'Проверяваме „' || NEW.title || '“ преди да се появи публично. Ще те уведомим, когато стане видима.',
      '/profile', NEW.id);
  END IF;
  RETURN NEW;
END; $function$;

-- 3) Soften the image-hold copy too (no timeframe promise).
CREATE OR REPLACE FUNCTION public.record_image_moderation(_image_id uuid, _status text, _score numeric, _labels jsonb, _provider text, _unavailable boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    PERFORM public.push_notification(_owner, 'content_held', 'Снимката се проверява',
      'Проверяваме снимка към „' || COALESCE(_title, 'задачата') || '“. Ще те уведомим, когато задачата стане видима.',
      '/profile', _task);
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $function$;

-- 4) The auto-approval engine: publishes a held task when EVERY automated check
--    came back clean. Any flag, uncertain image or provider outage keeps it held.
CREATE OR REPLACE FUNCTION public.finalize_task_publication(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE t public.tasks%ROWTYPE; _blockers int; _images int; _me uuid := auth.uid();
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF _me IS NOT NULL AND t.user_id <> _me AND NOT public.is_staff(_me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF t.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'published', t.status = 'active', 'held', false);
  END IF;

  -- Anything that needs a human: a flagged/high-severity item, or an image
  -- the provider was unsure about (including provider outages).
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

REVOKE ALL ON FUNCTION public.finalize_task_publication(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_task_publication(uuid) TO authenticated;

-- 5) Safety net: publish clean tasks whose author closed the tab mid-upload.
CREATE OR REPLACE FUNCTION public.sweep_autopublish(_limit int DEFAULT 200)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM public.tasks
           WHERE status = 'pending' AND deleted_at IS NULL AND created_at < now() - interval '2 minutes'
           ORDER BY created_at LIMIT _limit LOOP
    IF (public.finalize_task_publication(r.id)->>'published')::boolean THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END; $function$;

REVOKE ALL ON FUNCTION public.sweep_autopublish(int) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.run_cron_job(_job_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _run uuid; _rows integer := 0;
BEGIN
  INSERT INTO public.cron_runs (job_name) VALUES (_job_name) RETURNING id INTO _run;
  BEGIN
    IF _job_name = 'sweep_expiry_notifications' THEN
      _rows := public.sweep_expiry_notifications(500);
    ELSIF _job_name = 'sweep_engagements' THEN
      _rows := public.sweep_engagements(500);
    ELSIF _job_name = 'sweep_autopublish' THEN
      _rows := public.sweep_autopublish(200);
    ELSE
      RAISE EXCEPTION 'UNKNOWN_JOB %', _job_name;
    END IF;
    UPDATE public.cron_runs SET finished_at = now(), rows_processed = _rows WHERE id = _run;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.cron_runs SET finished_at = now(), error = SQLERRM WHERE id = _run;
  END;
END; $function$;

SELECT cron.schedule('sweep_autopublish', '*/5 * * * *', $$SELECT public.run_cron_job('sweep_autopublish')$$);

-- 6) Dashboard: auto-approval rate so a provider regression is visible.
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _auto int; _manual int; _held int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT count(*) FILTER (WHERE status = 'approved' AND resolved_by IS NULL),
         count(*) FILTER (WHERE status <> 'pending' AND resolved_by IS NOT NULL),
         count(*) FILTER (WHERE status = 'pending' OR resolved_by IS NOT NULL)
    INTO _auto, _manual, _held
    FROM public.moderation_items WHERE created_at > now() - interval '7 days';

  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'total_tasks', (SELECT count(*) FROM public.tasks WHERE deleted_at IS NULL),
    'active_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'active' AND deleted_at IS NULL),
    'assigned_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'assigned' AND deleted_at IS NULL),
    'tasks_7d', (SELECT count(*) FROM public.tasks WHERE created_at > now() - interval '7 days'),
    'tasks_30d', (SELECT count(*) FROM public.tasks WHERE created_at > now() - interval '30 days'),
    'credits_sold', (SELECT COALESCE(sum(credits), 0) FROM public.payments WHERE status = 'completed'),
    'revenue_total', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed'),
    'revenue_7d', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed' AND completed_at > now() - interval '7 days'),
    'revenue_30d', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed' AND completed_at > now() - interval '30 days'),
    'unlocks_total', (SELECT count(*) FROM public.task_unlocks),
    'pending_refunds', (SELECT count(*) FROM public.credit_refund_requests WHERE status = 'pending'),
    'auto_refunds_30d', (SELECT count(*) FROM public.credit_refund_requests WHERE resolution = 'auto' AND resolved_at > now() - interval '30 days'),
    'manual_refunds_30d', (SELECT count(*) FROM public.credit_refund_requests WHERE resolution = 'manual' AND resolved_at > now() - interval '30 days'),
    'flagged_users', (SELECT count(*) FROM public.profiles p WHERE public.is_refund_flagged(p.id)),
    'pending_reports', (SELECT count(*) FROM public.task_reports WHERE status = 'pending'),
    'moderation_pending', (SELECT count(*) FROM public.moderation_items WHERE status = 'pending'),
    'moderation_oldest', (SELECT min(created_at) FROM public.moderation_items WHERE status = 'pending'),
    'moderation_auto_7d', _auto,
    'moderation_manual_7d', _manual,
    'moderation_auto_rate_7d', CASE WHEN (_auto + _held) > 0
      THEN round((_auto::numeric * 100) / (_auto + _held), 1) ELSE NULL END,
    'tasks_pending', (SELECT count(*) FROM public.tasks WHERE status = 'pending' AND deleted_at IS NULL),
    'tasks_pending_oldest', (SELECT min(created_at) FROM public.tasks WHERE status = 'pending' AND deleted_at IS NULL),
    'contact_new', (SELECT count(*) FROM public.contact_messages WHERE status = 'new'),
    'violations_30d', (SELECT count(*) FROM public.content_violations WHERE created_at > now() - interval '30 days'),
    'credit_mismatches', (SELECT count(*) FROM public.profiles p
       WHERE p.credits <> COALESCE((SELECT sum(t.amount)::int FROM public.credit_transactions t WHERE t.user_id = p.id), 0)),
    'rule_engine_errors_7d', (SELECT count(*) FROM public.cron_runs
       WHERE job_name = 'refund_rule_engine' AND error IS NOT NULL AND started_at > now() - interval '7 days')
  );
END; $function$;