-- 1. Gibberish check tolerant of Latin brand/product tokens and short acronyms.
CREATE OR REPLACE FUNCTION public.is_gibberish(_text text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE s text; raw text; letters text; devoweled text; n int; v int; ratio numeric; maxc int;
BEGIN
  raw := lower(coalesce(_text, ''));

  -- Brand and product names written in Latin script (IKEA, JYSK, Bosch, iPhone,
  -- SKU codes) carry no signal for a Bulgarian gibberish heuristic and used to
  -- trip the consonant-cluster rules. Drop them before analysing, unless the
  -- text is Latin-only (then analyse it as-is).
  s := raw;
  IF raw ~ '[а-яё]' THEN
    s := regexp_replace(raw, '[a-z][a-z0-9''-]{0,15}', ' ', 'g');
    IF regexp_replace(s, '[^[:alpha:]]', '', 'g') = '' THEN
      s := raw;
    END IF;
  END IF;

  letters := regexp_replace(s, '[^[:alpha:]]', '', 'g');
  n := length(letters);
  IF n = 0 THEN RETURN true; END IF;

  IF s ~ '(.)\1{3,}' THEN RETURN true; END IF;

  IF s ~ '(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm|qazwsx|qwerty|йцук|цуке|укен|фыва|ячсм|абвгд|фдса|дсаф|ждло|ялдж|ъвер|ьбню|ючсм)' THEN
    RETURN true;
  END IF;

  v := n - length(regexp_replace(letters, '[аъоуеияюaeiouy]', '', 'g'));
  IF v = 0 AND n >= 5 THEN RETURN true; END IF;
  IF n >= 8 THEN
    ratio := v::numeric / n;
    IF ratio < 0.12 OR ratio > 0.88 THEN RETURN true; END IF;
  END IF;

  devoweled := regexp_replace(regexp_replace(s, '[аъоуеияюaeiouy]', ' ', 'g'), '[^[:alpha:]]', ' ', 'g');
  IF devoweled ~ '[[:alpha:]]{6,}' THEN RETURN true; END IF;

  IF n >= 10 THEN
    SELECT max(cnt) INTO maxc FROM (
      SELECT count(*) AS cnt FROM regexp_split_to_table(letters, '') g GROUP BY g
    ) x;
    IF maxc::numeric / n > 0.45 THEN RETURN true; END IF;
  END IF;

  RETURN false;
END;
$function$;

-- 2. moderate_text now reports the rule identity so every hold is auditable.
CREATE OR REPLACE FUNCTION public.moderate_text(_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF _text IS NULL OR length(trim(_text)) = 0 THEN
    RETURN jsonb_build_object('verdict','clean');
  END IF;
  FOR r IN SELECT * FROM public.moderation_rules WHERE is_active
           ORDER BY CASE WHEN severity = 'block' THEN 0 ELSE 1 END, created_at LOOP
    BEGIN
      IF _text ~ r.pattern THEN
        RETURN jsonb_build_object('verdict', CASE WHEN r.severity = 'block' THEN 'block' ELSE 'flag' END,
          'rule_id', r.id, 'pattern', r.pattern, 'category', r.category, 'note', r.note,
          'rule_severity', r.severity, 'lang', r.lang);
      END IF;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
  END LOOP;
  RETURN jsonb_build_object('verdict','clean');
END; $function$;

-- 3. Owner edit: never re-review ordinary text changes on an already approved task.
CREATE OR REPLACE FUNCTION public.update_own_task(_task_id uuid, _title text, _description text, _category text, _budget numeric, _city text, _neighborhood text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid(); t public.tasks%ROWTYPE; v jsonb;
  _flagged boolean := false; _approved_before boolean := false;
  _hold boolean := false; _apply_text boolean := true; _changes jsonb; _rule jsonb;
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

  -- The task counts as already approved when it is live, or when a moderator /
  -- the automated gate approved it earlier. Ordinary edits on such a task
  -- publish immediately — only a rule match sends the edit to review.
  _approved_before := t.status = 'active' OR EXISTS (
    SELECT 1 FROM public.moderation_items m
    WHERE m.task_id = _task_id AND m.content_type = 'task' AND m.status = 'approved');

  IF _approved_before THEN
    _hold := _flagged;
    -- Keep the previously approved text live while the edit waits for review.
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

  UPDATE public.tasks SET
    title = CASE WHEN _apply_text THEN _title ELSE t.title END,
    description = CASE WHEN _apply_text THEN _description ELSE t.description END,
    category = _category, budget = _budget, city = _city, neighborhood = _neighborhood,
    status = CASE
      WHEN _hold AND NOT _approved_before AND t.status IN ('active','pending') THEN 'pending'::task_status
      ELSE t.status END
  WHERE id = _task_id;

  INSERT INTO public.task_history (task_id, actor_id, action, changes)
  VALUES (_task_id, _me, 'edited', _changes || jsonb_build_object('held', _hold, 'rule', _rule));

  IF _hold THEN
    PERFORM public.enqueue_moderation('text', 'task', _task_id, _task_id, _me,
      CASE WHEN _flagged THEN 'medium' ELSE 'low' END,
      CASE WHEN _flagged THEN 'Редакция със съвпадение по правило: ' || COALESCE(NULLIF(v->>'note',''), COALESCE(v->>'category','правило'))
           ELSE 'Редакция от профил в проверка' END,
      COALESCE(v->>'category',''), v->>'pattern',
      COALESCE(_title,'') || ' — ' || COALESCE(_description,''),
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

-- 4. New tasks: record which rule fired so false positives are visible.
CREATE OR REPLACE FUNCTION public.tasks_moderate_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb; _flagged boolean;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  v := public.moderate_text(COALESCE(NEW.title,'') || E'\n' || COALESCE(NEW.description,''));
  _flagged := (v->>'verdict' = 'flag');

  PERFORM public.enqueue_moderation('text', 'task', NEW.id, NEW.id, NEW.user_id,
    CASE WHEN _flagged THEN 'medium' ELSE 'low' END,
    CASE WHEN _flagged THEN 'Съвпадение с правило за съдържание: ' || COALESCE(NULLIF(v->>'note',''), COALESCE(v->>'category','правило'))
         ELSE 'Нов профил — автоматична проверка' END,
    COALESCE(v->>'category',''), v->>'pattern',
    COALESCE(NEW.title,'') || ' — ' || COALESCE(NEW.description,''),
    jsonb_build_object('trust', public.user_trust(NEW.user_id), 'auto_eligible', NOT _flagged,
      'rule', jsonb_build_object('rule_id', v->>'rule_id', 'pattern', v->>'pattern',
        'category', v->>'category', 'note', v->>'note')));

  IF _flagged THEN
    PERFORM public.push_notification(NEW.user_id, 'content_held', 'Задачата ти се проверява',
      'Проверяваме „' || NEW.title || '“ преди да се появи публично. Ще те уведомим, когато стане видима.',
      '/profile', NEW.id);
  END IF;
  RETURN NEW;
END; $function$;

-- 5. Moderator resolution applies or discards a held edit without ever
--    taking the live, previously approved task offline.
CREATE OR REPLACE FUNCTION public.admin_resolve_moderation(_item_id uuid, _approve boolean, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); m public.moderation_items%ROWTYPE; _title text; _pending int; _edit jsonb;
BEGIN
  IF _me IS NULL OR NOT public.is_staff(_me) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  SELECT * INTO m FROM public.moderation_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF m.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_RESOLVED'); END IF;
  IF NOT _approve AND (_reason IS NULL OR length(trim(_reason)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;

  SELECT title INTO _title FROM public.tasks WHERE id = m.task_id;
  _edit := m.details->'pending_edit';

  IF _approve THEN
    IF m.content_type = 'task_image' THEN
      UPDATE public.task_images SET moderation_status = 'approved' WHERE id = m.content_id;
    END IF;

    -- Apply the edit that was withheld while the approved version stayed live.
    IF _edit IS NOT NULL AND jsonb_typeof(_edit) = 'object' AND m.task_id IS NOT NULL THEN
      UPDATE public.tasks
        SET title = COALESCE(_edit->>'title', title),
            description = COALESCE(_edit->>'description', description)
        WHERE id = m.task_id;
      PERFORM public.push_notification(m.user_id, 'content_approved', 'Промените са публикувани',
        'Редакцията на „' || COALESCE(_edit->>'title', COALESCE(_title,'Задача')) || '“ премина проверката.',
        '/task/' || m.task_id::text, m.task_id);
    END IF;

    IF m.task_id IS NOT NULL THEN
      SELECT count(*) INTO _pending FROM public.task_images ti
        WHERE ti.task_id = m.task_id AND ti.moderation_status = 'pending' AND ti.id <> COALESCE(m.content_id, '00000000-0000-0000-0000-000000000000'::uuid);
      IF _pending = 0 AND EXISTS (SELECT 1 FROM public.tasks WHERE id = m.task_id AND status = 'pending')
         AND NOT EXISTS (SELECT 1 FROM public.moderation_items o WHERE o.task_id = m.task_id AND o.id <> m.id AND o.status = 'pending' AND o.kind <> 'report') THEN
        UPDATE public.tasks SET status = 'active', bumped_at = now() WHERE id = m.task_id;
        PERFORM public.push_notification(m.user_id, 'content_approved', 'Задачата ти е публикувана',
          '„' || COALESCE(_title,'Задача') || '“ премина проверката и вече е видима за изпълнителите.',
          '/task/' || m.task_id::text, m.task_id);
      END IF;
    END IF;
  ELSE
    IF m.content_type = 'task_image' THEN
      UPDATE public.task_images SET moderation_status = 'rejected' WHERE id = m.content_id;
      DELETE FROM public.task_images WHERE id = m.content_id;
    ELSIF m.content_type = 'review' THEN
      UPDATE public.reviews SET hidden_at = now(), hidden_reason = _reason WHERE id = m.content_id;
      PERFORM public.recompute_review_aggregates((SELECT reviewee_id FROM public.reviews WHERE id = m.content_id));
    ELSIF m.content_type IN ('task') AND m.task_id IS NOT NULL THEN
      -- A rejected edit only discards the proposed text; the approved version
      -- that is already live stays online.
      IF _edit IS NULL OR jsonb_typeof(_edit) <> 'object' THEN
        UPDATE public.tasks SET status = 'inactive' WHERE id = m.task_id;
      END IF;
    END IF;

    IF m.user_id IS DISTINCT FROM _me AND NOT public.is_staff(m.user_id) THEN
      PERFORM public.record_content_violation(m.user_id, m.content_type, m.content_id,
        COALESCE(NULLIF(m.category,''), 'other'), 'block', false);
      PERFORM public.push_notification(m.user_id, 'content_rejected', 'Съдържанието ти беше отхвърлено',
        _reason || ' Прегледай правилата за съдържание и поправи публикацията.', '/terms', m.task_id);
    END IF;
  END IF;

  UPDATE public.moderation_items
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        resolved_by = _me, resolved_at = now(), resolution_reason = _reason
    WHERE id = _item_id;

  PERFORM public.log_admin_action(CASE WHEN _approve THEN 'moderation_approved' ELSE 'moderation_rejected' END,
    m.content_type, m.content_id, jsonb_build_object('item_id', _item_id, 'reason', COALESCE(_reason,''),
      'rule', COALESCE(m.details->'rule', '{}'::jsonb)));

  RETURN jsonb_build_object('ok', true);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.is_gibberish(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moderate_text(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tasks_moderate_after() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_task(uuid, text, text, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_moderation(uuid, boolean, text) TO authenticated;