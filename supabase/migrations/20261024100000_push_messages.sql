-- Chat messages as push notifications in the mobile app.
-- New messages do not create a row in public.notifications (they have their
-- own unread counter since 25 Aug), so the push trigger from 20261023100000
-- never saw them. This trigger sends a push for every new message to the
-- receiver's phones, unless the receiver turned message notifications off.

create or replace function public.messages_push_after_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _token text;
begin
  if not public.app_setting_bool('push_notifications_enabled', false) then
    return null;
  end if;
  if not exists (select 1 from public.push_devices d where d.user_id = new.receiver_id) then
    return null;
  end if;
  if exists (
    select 1 from public.notification_preferences p
    where p.user_id = new.receiver_id and p.messages = false
  ) then
    return null;
  end if;

  select token into _token from public.cron_secrets where name = 'push_send';
  if _token is null then
    return null;
  end if;

  begin
    perform net.http_post(
      url := 'https://tursya.bg/api/public/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', _token),
      body := jsonb_build_object('message_id', new.id)
    );
  exception when others then
    -- A push problem must never block the message itself.
    null;
  end;
  return null;
end;
$$;

revoke all on function public.messages_push_after_insert() from public, anon, authenticated;

drop trigger if exists trg_messages_push on public.messages;
create trigger trg_messages_push
  after insert on public.messages
  for each row execute function public.messages_push_after_insert();
