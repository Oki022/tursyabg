-- "Нови задачи за теб" page (/alerts): exactly the tasks that matched the
-- signed-in user's task alerts in the last 14 days, newest match first.
-- Same columns as feed_tasks so the client reuses the task card mapping.

create or replace function public.my_alert_tasks(_limit integer default 60)
returns table(
  id uuid, title text, description text, category text, budget numeric, budget_range text,
  city text, neighborhood text, status public.task_status, unlock_cost integer,
  created_at timestamptz, bumped_at timestamptz, user_id uuid, author text, images text[],
  is_top boolean, is_urgent boolean, promo_expires_at timestamptz, promoted_slot boolean,
  unlock_count integer, max_unlocks integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select t.id, t.title, t.description, t.category, t.budget, t.budget_range,
    t.city, t.neighborhood, t.status, t.unlock_cost,
    t.created_at, t.bumped_at, t.user_id, pr.full_name as author,
    coalesce((select array_agg(i.image_url order by i.sort_order)
              from public.task_images i where i.task_id = t.id), array[]::text[]) as images,
    exists (select 1 from public.task_promotions p
            where p.task_id = t.id and p.type = 'top' and p.expires_at > now()) as is_top,
    exists (select 1 from public.task_promotions u
            where u.task_id = t.id and u.type = 'urgent' and u.expires_at > now()) as is_urgent,
    (select max(p.expires_at) from public.task_promotions p
     where p.task_id = t.id and p.type = 'top' and p.expires_at > now()) as promo_expires_at,
    false as promoted_slot,
    t.unlock_count, t.max_unlocks
  from public.task_alert_hits h
  join public.tasks t on t.id = h.task_id
  left join public.profiles pr on pr.id = t.user_id
  where h.user_id = auth.uid()
    and h.created_at > now() - interval '14 days'
    and t.status = 'active'
    and t.deleted_at is null
  order by h.created_at desc, t.created_at desc
  limit least(greatest(_limit, 1), 100);
$$;

revoke all on function public.my_alert_tasks(integer) from public, anon;
grant execute on function public.my_alert_tasks(integer) to authenticated, service_role;

-- The digest notification may now also open /alerts.
create or replace function public.task_alert_finish(_user_id uuid, _count integer, _link text default '/tasks')
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _target text := case
    when _link = '/alerts' then _link
    when _link like '/tasks%' then _link
    when _link ~ '^/task/[0-9a-fA-F-]{36}$' then _link
    else '/alerts'
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

revoke all on function public.task_alert_finish(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.task_alert_finish(uuid, integer, text) to service_role;

notify pgrst, 'reload schema';
