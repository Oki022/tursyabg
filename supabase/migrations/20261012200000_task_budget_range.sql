-- "По договаряне": a task can have an approximate budget range instead of an
-- exact amount. The range is stored in tasks.budget_range; tasks.budget keeps
-- a representative value so the existing unlock-cost tiers (get_unlock_cost)
-- keep working unchanged.
--
-- The database, not the browser, decides that value: otherwise a client could
-- pick a range and send budget = 1 to make unlocks cheaper.
--
--   up_to_100 → 100 (5 т.)   100_300 → 300 (10 т.)   300_800 → 800 (20 т.)
--   800_2000 → 2000 (35 т.)  2000_5000 → 5000 (55 т.) over_5000 → 5001 (80 т.)
--   unknown → 300 (10 т.), so "не знам" is never the cheapest option.

alter table public.tasks
  add column if not exists budget_range text
  check (budget_range in ('up_to_100','100_300','300_800','800_2000','2000_5000','over_5000','unknown'));

create or replace function public.budget_for_range(_range text)
returns numeric
language sql
immutable
set search_path to 'public'
as $$
  select case _range
    when 'up_to_100' then 100
    when '100_300'   then 300
    when '300_800'   then 800
    when '800_2000'  then 2000
    when '2000_5000' then 5000
    when 'over_5000' then 5001
    when 'unknown'   then 300
  end::numeric;
$$;

-- Human-readable budget for notification texts.
create or replace function public.budget_label(_budget numeric, _range text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    when _range is null then trim(to_char(_budget, 'FM999999990.00')) || ' €'
    when _range = 'unknown' then 'по договаряне'
    else 'по договаряне (' || case _range
      when 'up_to_100' then 'до 100 €'
      when '100_300'   then '100–300 €'
      when '300_800'   then '300–800 €'
      when '800_2000'  then '800–2000 €'
      when '2000_5000' then '2000–5000 €'
      when 'over_5000' then 'над 5000 €'
    end || ')'
  end;
$$;

-- Runs before tasks_validate_quality_trg (triggers fire in name order).
create or replace function public.tasks_budget_range_sync()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.budget_range is not null then
    new.budget := public.budget_for_range(new.budget_range);
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_budget_range_sync on public.tasks;
create trigger tasks_budget_range_sync
  before insert or update on public.tasks
  for each row execute function public.tasks_budget_range_sync();

-- Feed: same query, plus budget_range in the result.
drop function if exists public.feed_tasks(integer, timestamptz, text, integer, text, text, text, text, text);

create function public.feed_tasks(_limit integer DEFAULT 20, _cursor timestamp with time zone DEFAULT NULL::timestamp with time zone, _seed text DEFAULT 'seed'::text, _promo_offset integer DEFAULT 0, _category text DEFAULT NULL::text, _city text DEFAULT NULL::text, _neighborhood text DEFAULT NULL::text, _q text DEFAULT NULL::text, _region text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, title text, description text, category text, budget numeric, city text, neighborhood text, status task_status, unlock_cost integer, created_at timestamp with time zone, bumped_at timestamp with time zone, user_id uuid, author text, images text[], is_top boolean, is_urgent boolean, promo_expires_at timestamp with time zone, promoted_slot boolean, unlock_count integer, max_unlocks integer, author_rating numeric, author_review_count integer, budget_range text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT t.* FROM public.tasks t
    WHERE t.status = 'active' AND t.deleted_at IS NULL
      AND (_category IS NULL OR t.category = _category)
      AND (_city IS NULL OR t.city = _city)
      AND (_neighborhood IS NULL OR t.neighborhood = _neighborhood)
      AND (_region IS NULL OR t.region_id = (SELECT r.id FROM public.regions r WHERE r.slug = _region))
      AND (_q IS NULL OR _q = '' OR t.title ILIKE '%' || _q || '%' OR t.description ILIKE '%' || _q || '%')
  ),
  tops AS (
    SELECT b.*, tp.expires_at AS top_expires FROM base b
    JOIN LATERAL (
      SELECT MAX(p.expires_at) AS expires_at FROM public.task_promotions p
      WHERE p.task_id = b.id AND p.type = 'top' AND p.expires_at > now()
    ) tp ON tp.expires_at IS NOT NULL
  ),
  promoted AS (
    SELECT * FROM tops ORDER BY md5(_seed || tops.id::text)
    LIMIT LEAST(GREATEST(_limit, 1), 4) OFFSET GREATEST(_promo_offset, 0)
  ),
  normal AS (
    SELECT b.* FROM base b
    WHERE NOT EXISTS (SELECT 1 FROM tops t WHERE t.id = b.id)
      AND (_cursor IS NULL OR b.bumped_at < _cursor)
    ORDER BY b.bumped_at DESC LIMIT GREATEST(_limit, 1)
  ),
  combined AS (
    SELECT p.*, true AS promoted_slot, 0 AS ord FROM promoted p
    UNION ALL
    SELECT n.*, NULL::timestamptz AS top_expires, false AS promoted_slot, 1 AS ord FROM normal n
  )
  SELECT c.id, c.title, c.description, c.category, c.budget, c.city, c.neighborhood, c.status,
    c.unlock_cost, c.created_at, c.bumped_at, c.user_id, pr.full_name AS author,
    COALESCE((SELECT array_agg(i.image_url ORDER BY i.sort_order) FROM public.task_images i WHERE i.task_id = c.id), ARRAY[]::text[]) AS images,
    (c.top_expires IS NOT NULL) AS is_top,
    EXISTS (SELECT 1 FROM public.task_promotions u WHERE u.task_id = c.id AND u.type = 'urgent' AND u.expires_at > now()) AS is_urgent,
    c.top_expires AS promo_expires_at, c.promoted_slot, c.unlock_count, c.max_unlocks,
    pr.rating_as_client AS author_rating, pr.review_count_as_client AS author_review_count,
    c.budget_range
  FROM combined c
  LEFT JOIN public.profiles pr ON pr.id = c.user_id
  ORDER BY c.ord, (CASE WHEN c.ord = 0 THEN md5(_seed || c.id::text) ELSE NULL END), c.bumped_at DESC;
$function$;

grant execute on function public.feed_tasks(integer, timestamptz, text, integer, text, text, text, text, text) to anon, authenticated, service_role;

-- Owner edit: same logic, plus the budget range. The old 7-argument version is
-- dropped so PostgREST never has to choose between two overloads.
drop function if exists public.update_own_task(uuid, text, text, text, numeric, text, text);

create function public.update_own_task(_task_id uuid, _title text, _description text, _category text, _budget numeric, _city text, _neighborhood text, _budget_range text DEFAULT NULL)
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
  _favourite_body text; _eff_budget numeric;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF t.user_id <> _me THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF t.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_DELETED'); END IF;
  IF _budget_range IS NOT NULL AND public.budget_for_range(_budget_range) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  _eff_budget := CASE WHEN _budget_range IS NOT NULL THEN public.budget_for_range(_budget_range) ELSE _budget END;
  IF _title IS NULL OR length(trim(_title)) < 3 OR _description IS NULL OR length(trim(_description)) < 3
     OR _category IS NULL OR _eff_budget IS NULL OR _eff_budget < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF COALESCE(t.unlock_count, 0) > 0 AND _eff_budget < t.budget THEN
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
    'budget', jsonb_build_array(t.budget, _eff_budget),
    'budget_range', jsonb_build_array(t.budget_range, _budget_range),
    'location', jsonb_build_array(concat_ws(', ', t.city, t.neighborhood), concat_ws(', ', _city, _neighborhood)));

  _title_changed := _apply_text AND t.title IS DISTINCT FROM _title;
  _desc_changed := _apply_text AND t.description IS DISTINCT FROM _description;
  _budget_changed := t.budget IS DISTINCT FROM _eff_budget OR t.budget_range IS DISTINCT FROM _budget_range;
  _city_changed := t.city IS DISTINCT FROM _city;

  UPDATE public.tasks SET
    title = CASE WHEN _apply_text THEN _title ELSE t.title END,
    description = CASE WHEN _apply_text THEN _description ELSE t.description END,
    category = _category, budget = _eff_budget, budget_range = _budget_range,
    city = _city, neighborhood = _neighborhood,
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
      _parts := _parts || ('бюджета (от ' || public.budget_label(t.budget, t.budget_range) || ' на '
        || public.budget_label(_eff_budget, _budget_range) || ')');
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
        'Бюджетът е променен от ' || public.budget_label(t.budget, t.budget_range) || ' на '
          || public.budget_label(_eff_budget, _budget_range) || '.'
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

revoke all on function public.update_own_task(uuid, text, text, text, numeric, text, text, text) from public, anon;
grant execute on function public.update_own_task(uuid, text, text, text, numeric, text, text, text) to authenticated, service_role;
