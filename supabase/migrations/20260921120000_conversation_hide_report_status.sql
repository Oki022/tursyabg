-- Sohbeti "benim için sil"
alter table public.conversations
  add column if not exists hidden_by_a_at timestamptz,
  add column if not exists hidden_by_b_at timestamptz;

create or replace function public.hide_conversation(_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare _me uuid := auth.uid(); c public.conversations;
begin
  if _me is null then return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); end if;
  select * into c from public.conversations where id = _conversation_id;
  if c.id is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if c.participant_a = _me then
    update public.conversations set hidden_by_a_at = now() where id = _conversation_id;
  elsif c.participant_b = _me then
    update public.conversations set hidden_by_b_at = now() where id = _conversation_id;
  else
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.hide_conversation(uuid) from public, anon;
grant execute on function public.hide_conversation(uuid) to authenticated;

-- Yeni mesaj gelince sohbet iki taraf için de tekrar görünsün
create or replace function public.messages_unhide_conversation() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  update public.conversations set hidden_by_a_at = null, hidden_by_b_at = null
   where id = new.conversation_id and (hidden_by_a_at is not null or hidden_by_b_at is not null);
  return new;
end $$;
revoke all on function public.messages_unhide_conversation() from public, anon, authenticated;

drop trigger if exists messages_unhide_conversation_trg on public.messages;
create trigger messages_unhide_conversation_trg
after insert on public.messages
for each row execute function public.messages_unhide_conversation();

-- Şikayet durumu + denetim kaydı
create or replace function public.admin_set_report_status(_report_id uuid, _status public.task_reports.status%type)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  update public.task_reports set status = _status where id = _report_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  perform public.log_admin_action(_action_type => 'report_' || _status::text, _target_type => 'task_report',
    _target_id => _report_id, _details => '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;
