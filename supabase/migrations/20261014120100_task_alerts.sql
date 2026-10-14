-- Saved searches ("Известия за нови задачи").
--
-- A professional saves a category and/or place. When a task goes live and
-- matches, a hit is queued. Every morning a scheduled job sends one digest per
-- user (in-app notification + e-mail) with the new matching tasks, and marks
-- the hits as sent. No hit, no message.

-- 1. Saved searches -------------------------------------------------------

create table if not exists public.task_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text check (category is null or length(category) between 1 and 40),
  city text check (city is null or length(city) between 1 and 80),
  region text check (region is null or length(region) between 1 and 60),
  created_at timestamptz not null default now()
);

create unique index if not exists task_alerts_unique
  on public.task_alerts (user_id, coalesce(category, ''), coalesce(city, ''), coalesce(region, ''));
create index if not exists task_alerts_category_city on public.task_alerts (category, city);

alter table public.task_alerts enable row level security;

drop policy if exists task_alerts_own_select on public.task_alerts;
create policy task_alerts_own_select on public.task_alerts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists task_alerts_own_insert on public.task_alerts;
create policy task_alerts_own_insert on public.task_alerts
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists task_alerts_own_delete on public.task_alerts;
create policy task_alerts_own_delete on public.task_alerts
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.task_alerts from anon;
grant select, insert, delete on public.task_alerts to authenticated;

-- At most 10 saved searches per user.
create or replace function public.task_alerts_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if (select count(*) from public.task_alerts where user_id = new.user_id) >= 10 then
    raise exception 'ALERT_LIMIT';
  end if;
  return new;
end;
$$;

drop trigger if exists task_alerts_limit_trg on public.task_alerts;
create trigger task_alerts_limit_trg
  before insert on public.task_alerts
  for each row execute function public.task_alerts_limit();

-- 2. Queue of matches (only the server reads it) ---------------------------

create table if not exists public.task_alert_hits (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (user_id, task_id)
);

create index if not exists task_alert_hits_pending
  on public.task_alert_hits (user_id) where notified_at is null;

alter table public.task_alert_hits enable row level security;
revoke all on public.task_alert_hits from anon, authenticated;

-- When a task goes live (published, or approved after review), queue it for
-- every matching saved search except the author's own.
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
    and (a.city is null or a.city = new.city)
    and (a.region is null or a.region = (select r.slug from public.regions r where r.id = new.region_id))
  on conflict do nothing;

  return null;
end;
$$;

drop trigger if exists zz_tasks_queue_alert_hits on public.tasks;
create trigger zz_tasks_queue_alert_hits
  after insert or update of status on public.tasks
  for each row execute function public.tasks_queue_alert_hits();

-- 3. Digest (called by the server with the service role) -----------------

create or replace function public.task_alert_digest_batch(_limit integer default 200)
returns table(user_id uuid, email text, full_name text, task_count integer, tasks jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  with pending as (
    select h.user_id, t.id, t.title, t.category, t.city, t.budget, t.budget_range, t.created_at
    from public.task_alert_hits h
    join public.tasks t on t.id = h.task_id
    where h.notified_at is null
      and h.created_at > now() - interval '3 days'
      and t.status = 'active'
      and t.deleted_at is null
  ),
  grouped as (
    select p.user_id,
      count(*)::integer as task_count,
      jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'category', p.category, 'city', p.city,
        'budget', p.budget, 'budget_range', p.budget_range
      ) order by p.created_at desc) as tasks
    from pending p
    group by p.user_id
  )
  select g.user_id, au.email::text, pr.full_name, g.task_count, g.tasks
  from grouped g
  join auth.users au on au.id = g.user_id
  left join public.profiles pr on pr.id = g.user_id
  where pr.banned_at is null
    and pr.deactivated_at is null
  limit greatest(_limit, 1);
$$;

-- Marks one user's digest as sent and adds the in-app notification.
create or replace function public.task_alert_finish(_user_id uuid, _count integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.task_alert_hits
  set notified_at = now()
  where user_id = _user_id and notified_at is null;

  if coalesce(_count, 0) > 0 then
    perform public.push_notification(
      _user_id,
      'task_alert'::public.notification_type,
      case when _count = 1 then '1 нова задача за теб' else _count || ' нови задачи за теб' end,
      case when _count = 1
        then 'Има нова задача по твоите търсения. Разгледай я, преди някой друг да се свърже.'
        else 'Има нови задачи по твоите търсения. Разгледай ги, преди някой друг да се свърже.'
      end,
      '/tasks',
      null
    );
  end if;

  -- Keep the queue small.
  delete from public.task_alert_hits where created_at < now() - interval '30 days';
end;
$$;

revoke all on function public.task_alert_digest_batch(integer) from public, anon, authenticated;
revoke all on function public.task_alert_finish(uuid, integer) from public, anon, authenticated;
grant execute on function public.task_alert_digest_batch(integer) to service_role;
grant execute on function public.task_alert_finish(uuid, integer) to service_role;

-- 4. Daily schedule ------------------------------------------------------

insert into public.cron_secrets (name, token)
select 'task_alerts', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.cron_secrets where name = 'task_alerts');

create or replace function public.call_task_alerts()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare _token text;
begin
  select token into _token from public.cron_secrets where name = 'task_alerts';
  perform net.http_post(
    url := 'https://tursya.bg/api/public/cron/task-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', _token),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.call_task_alerts() from public, anon, authenticated;

-- 05:30 UTC = 08:30 in Sofia in summer, 07:30 in winter.
select cron.schedule('task-alerts-daily', '30 5 * * *', 'SELECT public.call_task_alerts()');

notify pgrst, 'reload schema';
