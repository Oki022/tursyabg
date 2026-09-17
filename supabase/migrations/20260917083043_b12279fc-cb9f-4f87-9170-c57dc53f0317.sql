create or replace function public.profiles_protect_columns() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and (
       new.credits is distinct from old.credits
    or new.free_tasks_used_this_month is distinct from old.free_tasks_used_this_month
    or new.banned_at is distinct from old.banned_at
    or new.ban_reason is distinct from old.ban_reason
    or new.suspended_until is distinct from old.suspended_until
    or new.trust_level is distinct from old.trust_level
    or new.rating_as_pro is distinct from old.rating_as_pro
    or new.review_count_as_pro is distinct from old.review_count_as_pro
    or new.rating_as_client is distinct from old.rating_as_client
    or new.review_count_as_client is distinct from old.review_count_as_client
    or new.completed_jobs is distinct from old.completed_jobs
  ) then
    raise exception 'PROTECTED_COLUMN' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_protect_columns on public.profiles;
create trigger trg_profiles_protect_columns
before update on public.profiles
for each row execute function public.profiles_protect_columns();

alter policy tasks_update on public.tasks
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

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

revoke all on function public.admin_set_task_active(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_task_active(uuid, boolean, text) to authenticated;