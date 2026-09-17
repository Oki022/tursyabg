alter table public.tasks add column if not exists admin_hidden_at timestamptz;

create or replace function public.tasks_admin_hidden_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if not coalesce(public.is_staff(auth.uid()), false) then
    new.admin_hidden_at := old.admin_hidden_at;
    if old.admin_hidden_at is not null then
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists zz_tasks_admin_hidden_guard on public.tasks;
create trigger zz_tasks_admin_hidden_guard
before update on public.tasks
for each row execute function public.tasks_admin_hidden_guard();

create or replace function public.admin_set_task_active(_task_id uuid, _active boolean, _reason text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare _me uuid := auth.uid(); _title text; _owner uuid;
begin
  if _me is null or not public.is_staff(_me) then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  update public.tasks
     set status = case when _active then 'active'::task_status else 'inactive'::task_status end,
         admin_hidden_at = case when _active then null else now() end
   where id = _task_id and deleted_at is null
  returning title, user_id into _title, _owner;

  if _owner is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if _owner <> _me then
    if _active then
      perform public.push_notification(_owner, 'content_approved', 'Задачата ти е отново активна',
        'Задачата „' || coalesce(_title, 'Задача') || '“ отново се показва публично.', '/profile', _task_id);
    else
      perform public.push_notification(_owner, 'task_removed', 'Задачата ти беше скрита',
        'Задачата „' || coalesce(_title, 'Задача') || '“ временно не се показва публично. '
          || case when coalesce(trim(_reason), '') = '' then 'Причина: нарушение на правилата за съдържание.'
                  else 'Причина: ' || trim(_reason) end
          || ' Ако смяташ, че има грешка, пиши ни през страницата Контакти.', '/profile', _task_id);
    end if;
  end if;

  perform public.log_admin_action(case when _active then 'task_activated' else 'task_deactivated' end,
    'task', _task_id, jsonb_build_object('reason', coalesce(_reason, '')));

  return jsonb_build_object('ok', true);
end $$;