-- Contact form: restore the rate limit (CONTACT_RATE_LIMIT already has a
-- Bulgarian message in src/lib/errors.ts, but the function no longer checked
-- it). Each message also triggers a support e-mail and, since 14 Oct, a
-- confirmation e-mail to the given address, so the form must not be floodable.
--   * max 5 messages per hour per e-mail address
--   * max 5 messages per hour per signed-in user
--   * max 30 anonymous messages per hour in total (flood guard)

create or replace function public.submit_contact_message(_name text, _email text, _subject text, _body text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _id uuid;
  _uid uuid := auth.uid();
begin
  _name := trim(coalesce(_name, ''));
  _email := trim(coalesce(_email, ''));
  _subject := trim(coalesce(_subject, ''));
  _body := trim(coalesce(_body, ''));

  if length(_name) < 2 or length(_name) > 120 then
    raise exception 'CONTACT_INVALID_NAME' using errcode = 'check_violation';
  end if;
  if _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' or length(_email) > 320 then
    raise exception 'CONTACT_INVALID_EMAIL' using errcode = 'check_violation';
  end if;
  if length(_subject) < 2 or length(_subject) > 120 then
    raise exception 'CONTACT_INVALID_SUBJECT' using errcode = 'check_violation';
  end if;
  if length(_body) < 10 or length(_body) > 4000 then
    raise exception 'CONTACT_INVALID_BODY' using errcode = 'check_violation';
  end if;

  if (select count(*) from public.contact_messages c
      where lower(c.email) = lower(_email) and c.created_at > now() - interval '1 hour') >= 5
  then
    raise exception 'CONTACT_RATE_LIMIT' using errcode = 'check_violation';
  end if;

  if _uid is not null then
    if (select count(*) from public.contact_messages c
        where c.user_id = _uid and c.created_at > now() - interval '1 hour') >= 5
    then
      raise exception 'CONTACT_RATE_LIMIT' using errcode = 'check_violation';
    end if;
  elsif (select count(*) from public.contact_messages c
         where c.user_id is null and c.created_at > now() - interval '1 hour') >= 30
  then
    raise exception 'CONTACT_RATE_LIMIT' using errcode = 'check_violation';
  end if;

  insert into public.contact_messages (user_id, name, email, subject, body, status)
  values (_uid, _name, _email, _subject, _body, 'new')
  returning id into _id;

  return _id;
end;
$function$;

create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);

notify pgrst, 'reload schema';
