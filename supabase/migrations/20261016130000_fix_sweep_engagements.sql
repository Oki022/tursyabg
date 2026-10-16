-- sweep_engagements has failed every hour since 2 Sep with
-- 'record "e" is not assigned yet': the loop variable was called "e", the same
-- as the table alias, and the last loop referenced e.id inside its own query.
-- Same logic, with a separate loop variable (r) and unambiguous aliases.
-- Effect of the bug: no claim reminders, no expiry of old claims and hidden
-- reviews were never revealed. The first successful run catches up.

create or replace function public.sweep_engagements(_batch integer default 500)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _n integer := 0;
  _c integer;
  r record;
begin
  -- 1) Remind the client to confirm a claim older than 3 days.
  for r in
    select en.* from public.engagements en
    join public.tasks t on t.id = en.task_id
    where en.status = 'claimed' and en.reminded_at is null and en.claimed_at < now() - interval '3 days'
      and t.deleted_at is null and t.status <> 'inactive'
    order by en.claimed_at
    limit _batch
  loop
    update public.engagements set reminded_at = now() where id = r.id and reminded_at is null;
    if found then
      perform public.push_notification(r.client_id, 'engagement_reminder', 'Потвърди изпълнителя си',
        'Все още чакаме потвърждение за изпълнителя по задачата ти.', '/task/' || r.task_id::text, r.task_id);
      _n := _n + 1;
    end if;
  end loop;

  -- 2) Claims never confirmed within 7 days expire.
  with c as (
    select id from public.engagements
    where status = 'claimed' and claimed_at < now() - interval '7 days'
    order by claimed_at
    limit _batch
  ), upd as (
    update public.engagements en set status = 'expired' from c where en.id = c.id returning 1
  )
  select count(*) into _c from upd;
  _n := _n + _c;

  -- 3) Review reminder for both sides, at most once every 6 days.
  for r in
    select en.* from public.engagements en
    join public.tasks t on t.id = en.task_id
    where en.status = 'confirmed' and en.review_deadline > now() and en.confirmed_at < now() - interval '3 days'
      and t.deleted_at is null
    order by en.confirmed_at
    limit _batch
  loop
    perform public.push_notification(u.uid, 'review_reminder', 'Остави отзив',
      'Имаш още време да оставиш отзив за съвместната работа.', '/review/' || r.id::text, r.task_id)
    from (select r.client_id as uid union all select r.professional_id) u
    where not exists (
        select 1 from public.reviews rv where rv.engagement_id = r.id and rv.reviewer_id = u.uid)
      and not exists (
        select 1 from public.notifications n
        where n.user_id = u.uid and n.type = 'review_reminder'
          and n.task_id = r.task_id and n.created_at > now() - interval '6 days');
    _n := _n + 1;
  end loop;

  -- 4) After the review deadline, reveal reviews that are still hidden.
  for r in
    select en.* from public.engagements en
    where en.status = 'confirmed' and en.review_deadline <= now()
      and exists (select 1 from public.reviews rv where rv.engagement_id = en.id and rv.is_visible = false)
    order by en.review_deadline
    limit _batch
  loop
    perform public.reveal_engagement_reviews(r.id);
    _n := _n + 1;
  end loop;

  return _n;
end;
$function$;
