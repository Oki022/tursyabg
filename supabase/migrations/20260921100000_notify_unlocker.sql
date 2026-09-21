create or replace function public.task_unlocks_notify_unlocker() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare _title text;
begin
  select coalesce(title, 'Задача') into _title from public.tasks where id = new.task_id;
  perform public.push_notification(
    new.user_id, 'contact_unlocked',
    'Отключи контакт',
    'Отключи контакта по задача „' || _title || '“ за ' || new.credits_spent
      || ' кредита. Телефонът е видим на страницата на задачата.',
    '/task/' || new.task_id::text, new.task_id
  );
  return new;
end $$;

revoke all on function public.task_unlocks_notify_unlocker() from public, anon, authenticated;

drop trigger if exists task_unlocks_notify_unlocker_trg on public.task_unlocks;
create trigger task_unlocks_notify_unlocker_trg
after insert on public.task_unlocks
for each row execute function public.task_unlocks_notify_unlocker();