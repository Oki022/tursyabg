-- Task alerts: the in-app notification may open a single task (/task/<id>),
-- and the digest carries each task's region so the "see all" link can filter
-- by област when the new tasks are in different общини of the same област.

create or replace function public.task_alert_digest_batch(_limit integer default 200)
returns table(user_id uuid, email text, full_name text, task_count integer, tasks jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  with pending as (
    select h.user_id, t.id, t.title, t.category, t.city, t.budget, t.budget_range, t.created_at,
      r.slug as region
    from public.task_alert_hits h
    join public.tasks t on t.id = h.task_id
    left join public.regions r on r.id = t.region_id
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
        'region', p.region, 'budget', p.budget, 'budget_range', p.budget_range
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

create or replace function public.task_alert_finish(_user_id uuid, _count integer, _link text default '/tasks')
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _target text := case
    when _link like '/tasks%' then _link
    when _link ~ '^/task/[0-9a-fA-F-]{36}$' then _link
    else '/tasks'
  end;
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
      _target,
      null
    );
  end if;

  delete from public.task_alert_hits where created_at < now() - interval '30 days';
end;
$$;

revoke all on function public.task_alert_digest_batch(integer) from public, anon, authenticated;
grant execute on function public.task_alert_digest_batch(integer) to service_role;
revoke all on function public.task_alert_finish(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.task_alert_finish(uuid, integer, text) to service_role;

notify pgrst, 'reload schema';
