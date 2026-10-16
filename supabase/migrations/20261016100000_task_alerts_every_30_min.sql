-- Task alerts every 30 minutes (the server only acts between 07:00 and 22:00
-- Sofia time): the in-app notification goes out on every run, the e-mail at
-- most once every 3 hours per user and then lists everything not e-mailed yet.

alter table public.task_alert_hits add column if not exists emailed_at timestamptz;
-- Hits notified by the old daily digest were also e-mailed then.
update public.task_alert_hits set emailed_at = notified_at
where emailed_at is null and notified_at is not null;

create table if not exists public.task_alert_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_email_at timestamptz
);
alter table public.task_alert_state enable row level security;
revoke all on public.task_alert_state from anon, authenticated;

-- 1) In-app: one notification per user for everything new since the last run.
create or replace function public.task_alert_push_inapp()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select h.user_id,
      count(*)::integer as cnt,
      (array_agg(h.task_id order by h.created_at desc))[1] as first_task,
      max(h.created_at) as until_at
    from public.task_alert_hits h
    join public.tasks t on t.id = h.task_id
    left join public.profiles pr on pr.id = h.user_id
    where h.notified_at is null
      and h.created_at > now() - interval '3 days'
      and t.status = 'active'
      and t.deleted_at is null
      and pr.banned_at is null
      and pr.deactivated_at is null
    group by h.user_id
  loop
    perform public.push_notification(
      r.user_id,
      'task_alert'::public.notification_type,
      case when r.cnt = 1 then '1 нова задача за теб' else r.cnt || ' нови задачи за теб' end,
      case when r.cnt = 1
        then 'Има нова задача по твоите търсения. Разгледай я, преди някой друг да се свърже.'
        else 'Има нови задачи по твоите търсения. Разгледай ги, преди някой друг да се свърже.'
      end,
      case when r.cnt = 1 then '/task/' || r.first_task::text else '/alerts' end,
      null
    );
    update public.task_alert_hits
    set notified_at = now()
    where user_id = r.user_id and notified_at is null and created_at <= r.until_at;
    n := n + 1;
  end loop;

  delete from public.task_alert_hits where created_at < now() - interval '30 days';
  return n;
end;
$$;

-- 2) E-mail: users with tasks not e-mailed yet and no e-mail in the last 3 hours.
create or replace function public.task_alert_email_batch(_limit integer default 200)
returns table(user_id uuid, email text, full_name text, task_count integer, tasks jsonb, until_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  with pending as (
    select h.user_id, h.created_at as hit_at, t.id, t.title, t.category, t.city, t.budget,
      t.budget_range, t.created_at
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
        'id', p.id, 'title', p.title, 'category', p.category, 'city', p.city,
        'budget', p.budget, 'budget_range', p.budget_range
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

-- 3) After a successful e-mail.
create or replace function public.task_alert_mark_emailed(_user_id uuid, _until timestamptz)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.task_alert_hits
  set emailed_at = now()
  where user_id = _user_id and emailed_at is null and created_at <= _until;

  insert into public.task_alert_state (user_id, last_email_at)
  values (_user_id, now())
  on conflict (user_id) do update set last_email_at = excluded.last_email_at;
end;
$$;

revoke all on function public.task_alert_push_inapp() from public, anon, authenticated;
revoke all on function public.task_alert_email_batch(integer) from public, anon, authenticated;
revoke all on function public.task_alert_mark_emailed(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.task_alert_push_inapp() to service_role;
grant execute on function public.task_alert_email_batch(integer) to service_role;
grant execute on function public.task_alert_mark_emailed(uuid, timestamptz) to service_role;

-- Every 30 minutes instead of once a day.
select cron.unschedule('task-alerts-daily')
where exists (select 1 from cron.job where jobname = 'task-alerts-daily');
select cron.schedule('task-alerts-every-30-min', '*/30 * * * *', 'SELECT public.call_task_alerts()');

notify pgrst, 'reload schema';
