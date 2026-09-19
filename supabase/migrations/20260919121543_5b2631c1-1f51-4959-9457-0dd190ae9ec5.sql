UPDATE public.credit_packages
SET name = CASE credits
  WHEN 25 THEN 'Старт'
  WHEN 60 THEN 'Активен'
  WHEN 150 THEN 'Професионален'
  WHEN 400 THEN 'Максимален'
  ELSE name
END,
updated_at = now()
WHERE credits IN (25, 60, 150, 400);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notifications_actor_id_idx ON public.notifications(actor_id);

CREATE OR REPLACE FUNCTION public.unlock_task_contact(_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _task record;
  _existing record;
  _cost int;
  _balance int;
  _unlock_id uuid;
  _phone text;
  _name text;
  _professional_name text;
  _title text;
  _notification_id uuid;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;

  SELECT id, user_id, status, budget, title, unlock_count, max_unlocks
    INTO _task FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _task.user_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'OWN_TASK'); END IF;

  SELECT full_name INTO _name FROM public.profiles WHERE id = _task.user_id;
  SELECT phone INTO _phone FROM public.profile_contacts WHERE user_id = _task.user_id;

  SELECT * INTO _existing FROM public.task_unlocks WHERE task_id = _task_id AND user_id = _me;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'phone', _phone, 'name', _name,
      'credits_spent', _existing.credits_spent, 'unlock_id', _existing.id);
  END IF;

  IF _task.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error',
      CASE WHEN _task.status = 'assigned' THEN 'TASK_ASSIGNED' ELSE 'TASK_NOT_ACTIVE' END);
  END IF;

  IF _task.unlock_count >= _task.max_unlocks THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNLOCK_LIMIT_REACHED',
      'max_unlocks', _task.max_unlocks);
  END IF;

  _cost := public.get_unlock_cost(_task.budget);

  SELECT credits INTO _balance FROM public.profiles WHERE id = _me FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_CREDITS', 'cost', _cost, 'balance', coalesce(_balance,0));
  END IF;

  UPDATE public.profiles SET credits = credits - _cost WHERE id = _me RETURNING credits INTO _balance;

  INSERT INTO public.task_unlocks (task_id, user_id, credits_spent)
    VALUES (_task_id, _me, _cost) RETURNING id INTO _unlock_id;

  UPDATE public.tasks SET unlock_count = unlock_count + 1 WHERE id = _task_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, task_id, balance_after, description)
    VALUES (_me, -_cost, 'unlock', _task_id, _balance, 'Отключен контакт по задача');

  _title := COALESCE(_task.title, 'Задача');
  SELECT COALESCE(NULLIF(trim(full_name), ''), 'Потребител')
    INTO _professional_name FROM public.profiles WHERE id = _me;

  _notification_id := public.push_notification(
    _task.user_id, 'contact_unlocked',
    'Нов отключен контакт',
    COALESCE(_professional_name, 'Потребител') || ' отключи контакта по задача „' || _title || '“.',
    '/task/' || _task_id::text, _task_id
  );

  IF _notification_id IS NOT NULL THEN
    UPDATE public.notifications SET actor_id = _me WHERE id = _notification_id;
  END IF;

  IF _balance < 5 THEN
    PERFORM public.push_notification(_me, 'credits_low', 'Кредитите ти намаляват',
      'Оставащ баланс: ' || _balance || ' кредита. Купи още, за да отключваш контакти.',
      '/settings/billing', NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'already', false, 'phone', _phone, 'name', _name,
    'credits_spent', _cost, 'balance', _balance, 'unlock_id', _unlock_id,
    'unlock_count', _task.unlock_count + 1, 'max_unlocks', _task.max_unlocks);
END;
$function$;

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
  _parts text[] := '{}'; _title_changed boolean; _desc_changed boolean;
  _budget_changed boolean; _city_changed boolean; _final_title text; _u record;
  _favourite_body text;
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

    _favourite_body := CASE
      WHEN _budget_changed THEN
        'Бюджетът е променен от ' || trim(to_char(t.budget, 'FM999999990.00')) || ' € на '
          || trim(to_char(_budget, 'FM999999990.00')) || ' €.'
      ELSE 'Задача от любимите ти беше променена.'
    END;

    FOR _u IN
      SELECT DISTINCT f.user_id
      FROM public.favourites f
      WHERE f.task_id = _task_id
        AND f.user_id <> _me
        AND NOT EXISTS (
          SELECT 1 FROM public.task_unlocks tu
          WHERE tu.task_id = _task_id AND tu.user_id = f.user_id
        )
    LOOP
      PERFORM public.push_notification(_u.user_id, 'task_freshness', 'Променена любима задача',
        _favourite_body, '/task/' || _task_id::text, _task_id);
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
END;
$function$;