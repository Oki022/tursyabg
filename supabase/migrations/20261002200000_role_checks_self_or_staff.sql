-- is_staff() and has_role() used to answer for any user id, so any signed-in
-- user could call them over RPC and find out who the admins are.
--
-- Now they give the real answer only when:
--   * the caller asks about themselves (every RLS policy does this), or
--   * the caller is staff (admin RPCs that check other users), or
--   * there is no user JWT at all: service role, cron, triggers run by the
--     system, SQL editor.
-- Anyone else gets false.
--
-- auth.jwt() ->> 'role' is used instead of auth.uid() IS NULL, because an
-- anonymous visitor also has no uid but must not be treated as the system.

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when coalesce(auth.jwt() ->> 'role', 'system') not in ('authenticated', 'anon')
      or _user_id = auth.uid()
      or exists (
        select 1 from public.user_roles
        where user_id = auth.uid() and role in ('admin', 'moderator')
      )
    then exists (
      select 1 from public.user_roles
      where user_id = _user_id and role in ('admin', 'moderator')
    )
    else false
  end;
$$;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when coalesce(auth.jwt() ->> 'role', 'system') not in ('authenticated', 'anon')
      or _user_id = auth.uid()
      or exists (
        select 1 from public.user_roles
        where user_id = auth.uid() and role in ('admin', 'moderator')
      )
    then exists (
      select 1 from public.user_roles
      where user_id = _user_id and role = _role
    )
    else false
  end;
$$;