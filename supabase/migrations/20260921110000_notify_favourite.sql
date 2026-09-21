alter type public.notification_type add value if not exists 'task_favourited';

create table if not exists public.favourite_notices (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
alter table public.favourite_notices enable row level security;

create or replace function public.favourites_notify_owner() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare _owner uuid; _title text;
begin
  select user_id, coalesce(title, 'Задача') into _owner, _title from public.tasks where id = new.task_id;
  if _owner is null or _owner = new.user_id then return new; end if;

  insert into public.favourite_notices (task_id, user_id) values (new.task_id, new.user_id)
  on conflict do nothing;
  if not found then return new; end if;

  perform public.push_notification(
    _owner, 'task_favourited',
    'Задачата ти е добавена в любими',
    'Някой добави задачата „' || _title || '“ в любимите си.',
    '/task/' || new.task_id::text, new.task_id
  );
  return new;
end $$;

revoke all on function public.favourites_notify_owner() from public, anon, authenticated;

drop trigger if exists favourites_notify_owner_trg on public.favourites;
create trigger favourites_notify_owner_trg
after insert on public.favourites
for each row execute function public.favourites_notify_owner();