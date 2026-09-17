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