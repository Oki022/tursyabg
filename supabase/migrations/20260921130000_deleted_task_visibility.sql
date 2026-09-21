-- Kilidi açan kişi silinmiş ilanı artık göremez (sahip ve admin görmeye devam eder)
alter policy tasks_read on public.tasks
using (
  ((select auth.uid()) = user_id)
  or ((status = 'active'::task_status) and (deleted_at is null) and (not exists (
        select 1 from public.profiles p where p.id = tasks.user_id and p.banned_at is not null)))
  or is_staff((select auth.uid()))
  or ((deleted_at is null) and exists (
        select 1 from public.task_unlocks u where u.task_id = tasks.id and u.user_id = (select auth.uid())))
);

-- Silinmiş ilanda yeni mesaj gönderilemez
create or replace function public.can_message_on_task(_task_id uuid, _sender uuid, _receiver uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select (auth.uid() is null or _sender = auth.uid()) and exists (
    select 1 from public.tasks t where t.id = _task_id and t.deleted_at is null and (
      (t.user_id = _sender   and exists (select 1 from public.task_unlocks u where u.task_id = t.id and u.user_id = _receiver))
   or (t.user_id = _receiver and exists (select 1 from public.task_unlocks u where u.task_id = t.id and u.user_id = _sender))
    ));
$$;