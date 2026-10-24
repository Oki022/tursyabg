-- Push notifications for the mobile app (Android now, iPhone later).
-- The app registers its Firebase (FCM) token after sign-in; every new row in
-- public.notifications is then also sent to the user's phones by
-- /api/public/push/send. Nothing is sent until the app setting
-- 'push_notifications_enabled' is true (set it on the live project only,
-- after FIREBASE_SERVICE_ACCOUNT is in Vercel).

create table if not exists public.push_devices (
  token text primary key check (length(token) between 20 and 4096),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_devices_user on public.push_devices (user_id);

alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon, authenticated;

-- The phone's token belongs to whoever is signed in on it now: if another
-- account used the same phone before, the token moves to the current user.
create or replace function public.register_push_device(_token text, _platform text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if _platform not in ('android', 'ios') or length(coalesce(_token, '')) not between 20 and 4096 then
    raise exception 'INVALID_INPUT' using errcode = 'check_violation';
  end if;

  insert into public.push_devices (token, user_id, platform)
  values (_token, _uid, _platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();

  -- At most 10 phones per user; the oldest ones are dropped.
  delete from public.push_devices
  where user_id = _uid
    and token in (
      select token from public.push_devices
      where user_id = _uid
      order by last_seen_at desc
      offset 10
    );
end;
$$;

-- On sign-out: this phone stops getting the user's notifications.
create or replace function public.unregister_push_device(_token text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.push_devices where token = _token and user_id = auth.uid();
$$;

revoke all on function public.register_push_device(text, text) from public, anon;
revoke all on function public.unregister_push_device(text) from public, anon;
grant execute on function public.register_push_device(text, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;

-- Secret for the database -> server call, like the cron jobs.
insert into public.cron_secrets (name, token)
select 'push_send', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.cron_secrets where name = 'push_send');

insert into public.app_settings (key, value, description)
values ('push_notifications_enabled', 'false'::jsonb,
  'Изпраща известията и като push към мобилното приложение. Включва се само на живия проект.')
on conflict (key) do nothing;

-- After a notification is created: ask the server to push it, only when push
-- is switched on and the user has at least one registered phone. pg_net is
-- asynchronous, so this never slows down or breaks the insert.
create or replace function public.notifications_push_after_insert()
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
  if not exists (select 1 from public.push_devices d where d.user_id = new.user_id) then
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
      body := jsonb_build_object('notification_id', new.id)
    );
  exception when others then
    -- A push problem must never block the notification itself.
    null;
  end;
  return null;
end;
$$;

revoke all on function public.notifications_push_after_insert() from public, anon, authenticated;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push
  after insert on public.notifications
  for each row execute function public.notifications_push_after_insert();

notify pgrst, 'reload schema';
