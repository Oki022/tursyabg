-- Task alert e-mails only for tasks the user has not seen on the site.
-- Before: every new matching task went to the in-app notifications and then
-- again by e-mail (at most once every 3 hours), so the same task arrived twice.
-- Now the e-mail is a fallback: a task goes into it only when its in-app
-- notification is still unread 3 hours after it was sent. Opening the bell
-- marks notifications as read, so a user who checks the site gets no e-mail.
-- The limit of one e-mail per user every 3 hours stays.

-- Which in-app notification announced the hit. No foreign key on purpose: if
-- the notification is deleted later, the hit counts as seen (it was shown).
alter table public.task_alert_hits add column if not exists notification_id uuid;

-- Hits waiting for an e-mail right now: link them to the notification that was
-- created in the same run (same transaction, so created_at = notified_at).
update public.task_alert_hits h
set notification_id = n.id
from public.notifications n
where h.notification_id is null
  and h.emailed_at is null
  and h.notified_at is not null
  and n.user_id = h.user_id
  and n.type = 'task_alert'::public.notification_type
  and n.created_at = h.notified_at;

-- 1) In-app: unchanged, except that it remembers the notification id.
create or replace function public.task_alert_push_inapp()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  n integer := 0;
  _notification uuid;
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
    _notification := public.push_notification(
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
    set notified_at = now(), notification_id = _notification
    where user_id = r.user_id and notified_at is null and created_at <= r.until_at;
    n := n + 1;
  end loop;

  delete from public.task_alert_hits where created_at < now() - interval '30 days';
  return n;
end;
$$;

-- 2) E-mail: only tasks whose in-app notification is still unread 3 hours
-- after it was sent. When no in-app notification was created (for example the
-- user turned them off), the e-mail still goes after the same 3 hours.
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
    left join public.notifications n on n.id = h.notification_id
    where h.emailed_at is null
      and h.notified_at is not null
      and h.notified_at <= now() - interval '3 hours'
      and h.created_at > now() - interval '3 days'
      and (
        h.notification_id is null
        or (n.id is not null and n.read_at is null)
      )
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

revoke all on function public.task_alert_push_inapp() from public, anon, authenticated;
revoke all on function public.task_alert_email_batch(integer) from public, anon, authenticated;
grant execute on function public.task_alert_push_inapp() to service_role;
grant execute on function public.task_alert_email_batch(integer) to service_role;

notify pgrst, 'reload schema';
