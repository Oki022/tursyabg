-- Subcategories ("вид услуга") for tasks, the /tasks filter and task alerts.
-- The 10 categories stay as they are; the list of valid subcategory ids lives
-- in src/lib/subcategories.ts. Older tasks keep subcategory = null.

-- 1. Tasks ---------------------------------------------------------------
alter table public.tasks add column if not exists subcategory text
  check (subcategory is null or subcategory ~ '^[a-z0-9-]{1,40}$');
grant insert (subcategory) on public.tasks to authenticated;
create index if not exists tasks_category_subcategory on public.tasks (category, subcategory)
  where status = 'active' and deleted_at is null;

-- The owner sets the subcategory after update_own_task (which handles
-- moderation of the text fields); the subcategory needs no moderation.
create or replace function public.set_task_subcategory(_task_id uuid, _subcategory text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if _subcategory is not null and _subcategory !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'INVALID_INPUT';
  end if;
  update public.tasks
  set subcategory = _subcategory
  where id = _task_id and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;
revoke all on function public.set_task_subcategory(uuid, text) from public, anon;
grant execute on function public.set_task_subcategory(uuid, text) to authenticated;

-- 2. Feed: optional subcategory filter, subcategory in the result ----------
drop function if exists public.feed_tasks(integer, timestamptz, text, integer, text, text, text, text, text);

create function public.feed_tasks(_limit integer DEFAULT 20, _cursor timestamp with time zone DEFAULT NULL::timestamp with time zone, _seed text DEFAULT 'seed'::text, _promo_offset integer DEFAULT 0, _category text DEFAULT NULL::text, _city text DEFAULT NULL::text, _neighborhood text DEFAULT NULL::text, _q text DEFAULT NULL::text, _region text DEFAULT NULL::text, _subcategory text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, title text, description text, category text, budget numeric, city text, neighborhood text, status task_status, unlock_cost integer, created_at timestamp with time zone, bumped_at timestamp with time zone, user_id uuid, author text, images text[], is_top boolean, is_urgent boolean, promo_expires_at timestamp with time zone, promoted_slot boolean, unlock_count integer, max_unlocks integer, author_rating numeric, author_review_count integer, budget_range text, subcategory text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT t.* FROM public.tasks t
    WHERE t.status = 'active' AND t.deleted_at IS NULL
      AND (_category IS NULL OR t.category = _category)
      AND (_subcategory IS NULL OR t.subcategory = _subcategory)
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
    c.budget_range, c.subcategory
  FROM combined c
  LEFT JOIN public.profiles pr ON pr.id = c.user_id
  ORDER BY c.ord, (CASE WHEN c.ord = 0 THEN md5(_seed || c.id::text) ELSE NULL END), c.bumped_at DESC;
$function$;


grant execute on function public.feed_tasks(integer, timestamptz, text, integer, text, text, text, text, text, text) to anon, authenticated, service_role;

-- 3. Alerts: optional list of subcategories (null = the whole category) -----
alter table public.task_alerts add column if not exists subcategories text[]
  check (subcategories is null or (cardinality(subcategories) between 1 and 15));

drop index if exists public.task_alerts_unique;
create unique index task_alerts_unique on public.task_alerts (
  user_id, coalesce(category, ''), coalesce(city, ''), coalesce(region, ''),
  coalesce(subcategories, '{}'::text[])
);

create or replace function public.tasks_queue_alert_hits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status <> 'active' or new.deleted_at is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return null;
  end if;

  insert into public.task_alert_hits (user_id, task_id)
  select distinct a.user_id, new.id
  from public.task_alerts a
  where a.user_id <> new.user_id
    and (a.category is null or a.category = new.category)
    and (a.subcategories is null or new.subcategory = any(a.subcategories))
    and (a.city is null or a.city = new.city)
    and (a.region is null or a.region = (select r.slug from public.regions r where r.id = new.region_id))
  on conflict do nothing;

  return null;
end;
$$;

-- 4. E-mail digest: include the subcategory --------------------------------
create or replace function public.task_alert_email_batch(_limit integer default 200)
returns table(user_id uuid, email text, full_name text, task_count integer, tasks jsonb, until_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  with pending as (
    select h.user_id, h.created_at as hit_at, t.id, t.title, t.category, t.subcategory, t.city,
      t.budget, t.budget_range, t.created_at
    from public.task_alert_hits h
    join public.tasks t on t.id = h.task_id
    where h.emailed_at is null
      and h.created_at > now() - interval '3 days'
      and t.status = 'active'
      and t.deleted_at is null
      and not exists (
        select 1 from public.task_alert_state s
        where s.user_id = h.user_id and s.last_email_at > now() - interval '3 hours'
      )
  ),
  grouped as (
    select p.user_id,
      count(*)::integer as task_count,
      jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'category', p.category, 'subcategory', p.subcategory,
        'city', p.city, 'budget', p.budget, 'budget_range', p.budget_range
      ) order by p.created_at desc) as tasks,
      max(p.hit_at) as until_at
    from pending p
    group by p.user_id
  )
  select g.user_id, au.email::text, pr.full_name, g.task_count, g.tasks, g.until_at
  from grouped g
  join auth.users au on au.id = g.user_id
  left join public.profiles pr on pr.id = g.user_id
  where pr.banned_at is null
    and pr.deactivated_at is null
  limit greatest(_limit, 1);
$$;

notify pgrst, 'reload schema';
