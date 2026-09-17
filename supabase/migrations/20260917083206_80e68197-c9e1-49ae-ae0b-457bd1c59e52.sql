alter table public.tasks add column if not exists content_edited_at timestamptz;
alter table public.tasks add column if not exists reposted_at timestamptz;

-- Owner cannot bring an admin-hidden task back to life.
create or replace function public.confirm_task_active(_task_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
DECLARE _me uuid := auth.uid(); _owner uuid; _hidden timestamptz;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT user_id, admin_hidden_at INTO _owner, _hidden FROM public.tasks WHERE id = _task_id;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _owner <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF _hidden IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'ADMIN_HIDDEN'); END IF;
  UPDATE public.tasks
     SET status = 'active', bumped_at = now(), freshness_prompt_at = NULL,
         expires_at = GREATEST(expires_at, now() + interval '30 days')
   WHERE id = _task_id;
  RETURN jsonb_build_object('ok', true);
END; $function$;

create or replace function public.reactivate_own_account()
returns void language plpgsql security definer set search_path to 'public' as $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND anonymized_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ACCOUNT_ANONYMIZED';
  END IF;

  UPDATE public.tasks
     SET status = COALESCE(status_before_deactivation, status),
         status_before_deactivation = NULL
   WHERE user_id = _uid AND status_before_deactivation IS NOT NULL AND deleted_at IS NULL
     AND admin_hidden_at IS NULL;

  -- Admin-hidden tasks stay hidden, but drop the stored pre-deactivation status
  -- so they are never silently restored later.
  UPDATE public.tasks
     SET status_before_deactivation = NULL
   WHERE user_id = _uid AND status_before_deactivation IS NOT NULL AND admin_hidden_at IS NOT NULL;

  UPDATE public.account_deletion_requests
     SET status = 'cancelled'
   WHERE user_id = _uid AND status = 'pending';

  UPDATE public.profiles SET deactivated_at = NULL WHERE id = _uid;
END; $function$;

-- Repost guards -------------------------------------------------------------
create or replace function public.can_repost_task(_source_task_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
DECLARE t public.tasks%ROWTYPE; _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _source_task_id;
  IF NOT FOUND OR t.user_id <> _me OR t.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF t.admin_hidden_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'ADMIN_HIDDEN'); END IF;
  IF t.reposted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_REPOSTED'); END IF;
  RETURN jsonb_build_object('ok', true);
END; $function$;

revoke all on function public.can_repost_task(uuid) from public, anon;
grant execute on function public.can_repost_task(uuid) to authenticated;

create or replace function public.mark_task_reposted(_source_task_id uuid, _new_task_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
DECLARE _me uuid := auth.uid(); _ok jsonb;
BEGIN
  _ok := public.can_repost_task(_source_task_id);
  IF (_ok->>'ok')::boolean IS NOT TRUE THEN RETURN _ok; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = _new_task_id AND user_id = _me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  UPDATE public.tasks SET reposted_at = now() WHERE id = _source_task_id;
  RETURN jsonb_build_object('ok', true);
END; $function$;

revoke all on function public.mark_task_reposted(uuid, uuid) from public, anon;
grant execute on function public.mark_task_reposted(uuid, uuid) to authenticated;

create or replace function public.copy_task_images(_source_task_id uuid, _new_task_id uuid, _exclude_ids uuid[] DEFAULT '{}'::uuid[])
returns integer language plpgsql security definer set search_path to 'public' as $function$
DECLARE _me uuid := auth.uid(); _count int;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = _source_task_id AND user_id = _me AND admin_hidden_at IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = _new_task_id AND user_id = _me) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.task_images (task_id, image_url, sort_order, moderation_status, moderation_score, moderation_labels, moderation_provider)
  SELECT _new_task_id, image_url, sort_order, moderation_status, moderation_score, moderation_labels, moderation_provider
  FROM public.task_images
  WHERE task_id = _source_task_id
    AND moderation_status = 'approved'
    AND NOT (id = ANY(_exclude_ids))
  ORDER BY sort_order;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END; $function$;

-- Edits: stamp content_edited_at and tell everyone who unlocked the contact.
create or replace function public.update_own_task(_task_id uuid, _title text, _description text, _category text, _budget numeric, _city text, _neighborhood text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  _me uuid := auth.uid(); t public.tasks%ROWTYPE; v jsonb;
  _flagged boolean := false; _approved_before boolean := false;
  _hold boolean := false; _apply_text boolean := true; _changes jsonb; _rule jsonb;
  _parts text[] := '{}'; _title_changed boolean; _desc_changed boolean;
  _budget_changed boolean; _city_changed boolean; _final_title text; _u record;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF t.user_id <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF t.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_DELETED'); END IF;
  IF _title IS NULL OR length(trim(_title)) < 3 OR _description IS NULL OR length(trim(_description)) < 3
     OR _category IS NULL OR _budget IS NULL OR _budget < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF COALESCE(t.unlock_count, 0) > 0 AND _budget < t.budget THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BUDGET_LOCKED');
  END IF;

  v := public.moderate_text(COALESCE(_title,'') || E'\n' || COALESCE(_description,''));
  IF v->>'verdict' = 'block' THEN
    PERFORM public.record_content_violation(_me, 'task', _task_id, v->>'category', 'block', true);
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_BLOCKED:' || COALESCE(v->>'category',''));
  END IF;

  _flagged := (v->>'verdict' = 'flag');
  _rule := jsonb_build_object('rule_id', v->>'rule_id', 'pattern', v->>'pattern',
    'category', v->>'category', 'note', v->>'note');

  _approved_before := t.status = 'active' OR EXISTS (
    SELECT 1 FROM public.moderation_items m
    WHERE m.task_id = _task_id AND m.content_type = 'task' AND m.status = 'approved');

  IF _approved_before THEN
    _hold := _flagged;
    _apply_text := NOT _flagged;
  ELSE
    _hold := _flagged OR public.needs_prepublish_review(_me);
  END IF;

  _changes := jsonb_build_object(
    'title', jsonb_build_array(t.title, _title),
    'description_changed', (t.description IS DISTINCT FROM _description),
    'category', jsonb_build_array(t.category, _category),
    'budget', jsonb_build_array(t.budget, _budget),
    'location', jsonb_build_array(concat_ws(', ', t.city, t.neighborhood), concat_ws(', ', _city, _neighborhood)));

  _title_changed := _apply_text AND t.title IS DISTINCT FROM _title;
  _desc_changed := _apply_text AND t.description IS DISTINCT FROM _description;
  _budget_changed := t.budget IS DISTINCT FROM _budget;
  _city_changed := t.city IS DISTINCT FROM _city;

  UPDATE public.tasks SET
    title = CASE WHEN _apply_text THEN _title ELSE t.title END,
    description = CASE WHEN _apply_text THEN _description ELSE t.description END,
    category = _category, budget = _budget, city = _city, neighborhood = _neighborhood,
    content_edited_at = CASE
      WHEN _title_changed OR _desc_changed OR _budget_changed OR _city_changed
        OR t.category IS DISTINCT FROM _category OR t.neighborhood IS DISTINCT FROM _neighborhood
      THEN now() ELSE content_edited_at END,
    status = CASE
      WHEN _hold AND NOT _approved_before AND t.status IN ('active','pending') THEN 'pending'::task_status
      ELSE t.status END
  WHERE id = _task_id;

  INSERT INTO public.task_history (task_id, actor_id, action, changes)
  VALUES (_task_id, _me, 'edited', _changes || jsonb_build_object('held', _hold, 'rule', _rule));

  -- Tell the professionals who paid to unlock this task what the client changed.
  IF _title_changed OR _desc_changed OR _budget_changed OR _city_changed THEN
    IF _title_changed THEN _parts := _parts || 'заглавието'; END IF;
    IF _desc_changed THEN _parts := _parts || 'описанието'; END IF;
    IF _budget_changed THEN
      _parts := _parts || ('бюджета (от ' || trim(to_char(t.budget, 'FM999999990.00')) || ' € на '
        || trim(to_char(_budget, 'FM999999990.00')) || ' €)');
    END IF;
    IF _city_changed THEN _parts := _parts || ('града (от ' || COALESCE(NULLIF(t.city,''), 'без град')
      || ' на ' || COALESCE(NULLIF(_city,''), 'без град') || ')'); END IF;

    _final_title := CASE WHEN _apply_text THEN _title ELSE t.title END;

    FOR _u IN SELECT DISTINCT user_id FROM public.task_unlocks
              WHERE task_id = _task_id AND user_id <> _me LOOP
      PERFORM public.push_notification(_u.user_id, 'task_freshness', 'Променена задача',
        'Възложителят промени ' || array_to_string(_parts, ', ') || ' на задачата „' || _final_title || '“.',
        '/task/' || _task_id::text, _task_id);
    END LOOP;
  END IF;

  IF _hold THEN
    PERFORM public.enqueue_moderation('text', 'task', _task_id, _task_id, _me,
      CASE WHEN _flagged THEN 'medium' ELSE 'low' END,
      CASE WHEN _flagged THEN 'Редакция със съвпадение по правило: ' || COALESCE(NULLIF(v->>'note',''), COALESCE(v->>'category','правило'))
           ELSE 'Редакция от профил в проверка' END,
      COALESCE(v->>'category',''), v->>'pattern',
      COALESCE(_title,'') || ', ' || COALESCE(_description,''),
      jsonb_build_object('trust', public.user_trust(_me), 'edit', true, 'rule', _rule,
        'kept_live', NOT _apply_text,
        'pending_edit', CASE WHEN NOT _apply_text
          THEN jsonb_build_object('title', _title, 'description', _description) ELSE NULL END));
    PERFORM public.push_notification(_me, 'content_held', 'Промените чакат преглед',
      CASE WHEN NOT _apply_text
        THEN 'Редакцията на „' || t.title || '“ съвпадна с правило за съдържание ('
             || COALESCE(NULLIF(v->>'note',''), COALESCE(NULLIF(v->>'category',''),'проверка')) ||
             '). Досегашната одобрена версия остава активна, докато проверим промените.'
        ELSE 'Проверяваме редакцията на „' || _title || '“ преди тя да стане публична.' END,
      '/profile', _task_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'pending', _hold, 'kept_live', NOT _apply_text,
    'reason', COALESCE(NULLIF(v->>'note',''), NULLIF(v->>'category','')));
END; $function$;