-- The morning digest notification opens /tasks with the user's saved search
-- filters when they have exactly one; the server passes that link in.
drop function if exists public.task_alert_finish(uuid, integer);

create function public.task_alert_finish(_user_id uuid, _count integer, _link text default '/tasks')
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _target text := case when _link like '/tasks%' then _link else '/tasks' end;
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
