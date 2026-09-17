create or replace function public.can_message_on_task(_task_id uuid, _sender uuid, _receiver uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select (auth.uid() is null or _sender = auth.uid()) and exists (
    select 1 from public.tasks t where t.id = _task_id and (
      (t.user_id = _sender   and exists (select 1 from public.task_unlocks u where u.task_id = t.id and u.user_id = _receiver))
   or (t.user_id = _receiver and exists (select 1 from public.task_unlocks u where u.task_id = t.id and u.user_id = _sender))
    ));
$$;
revoke all on function public.can_message_on_task(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_message_on_task(uuid, uuid, uuid) to authenticated;

alter policy messages_sender_insert on public.messages
with check (
  (select auth.uid()) = sender_id
  and conversation_id is not null
  and task_id is not null
  and exists (select 1 from public.conversations c
              where c.id = conversation_id
                and ((c.participant_a = sender_id and c.participant_b = receiver_id)
                  or (c.participant_b = sender_id and c.participant_a = receiver_id)))
  and public.can_message_on_task(task_id, sender_id, receiver_id)
);

revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;