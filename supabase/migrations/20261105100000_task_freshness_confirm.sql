-- Task lifetime: the owner can now confirm that a task is still open, and bring an
-- automatically deactivated task back, without it jumping to the top of the feed.
--
-- Rules (unchanged): a task is live 30 days. After 14 days without a confirmation the owner
-- is asked "still open?"; without an answer in 7 days the task is deactivated.
--
-- Fixes:
--  1. confirm_task_active had no checks on the task state: an owner could switch on a task
--     that was still in review, rejected by a moderator, or belonged to a banned, suspended or
--     deactivated account. It also moved the task to the top of the feed (a free paid bump).
--  2. The 14-day question was based on created_at only, so right after a confirmation the
--     sweep asked again and deactivated the task 7 days later. It now counts from the last
--     confirmation / bump.
--  3. Deactivation after the unanswered question now tells the owner.
--  4. "Task expired" is sent again after a reactivated task expires a second time.
--  5. sweep_expiry_notifications(integer) was callable by any API user.

alter table public.tasks add column if not exists confirmed_at timestamptz;

comment on column public.tasks.confirmed_at is
  'Last time the owner confirmed the task is still open (confirm_task_active). Does not affect feed order.';

create or replace function public.confirm_task_active(_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _me uuid := auth.uid();
  t public.tasks%rowtype;
  p record;
begin
  if _me is null then return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); end if;

  select * into t from public.tasks where id = _task_id for update;
  if not found or t.deleted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND');
  end if;
  if t.user_id <> _me then return jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); end if;
  if t.admin_hidden_at is not null then return jsonb_build_object('ok', false, 'error', 'ADMIN_HIDDEN'); end if;
  if t.status not in ('active', 'inactive', 'assigned') then
    -- pending (in review) and pending_payment are switched on only by moderation / payment
    return jsonb_build_object('ok', false, 'error', 'TASK_PENDING');
  end if;
  if t.reposted_at is not null then
    -- the task already lives on as its reposted copy
    return jsonb_build_object('ok', false, 'error', 'TASK_REPOSTED');
  end if;

  select deactivated_at, banned_at, suspended_until, anonymized_at into p
    from public.profiles where id = _me;
  if p.anonymized_at is not null or p.deactivated_at is not null then
    return jsonb_build_object('ok', false, 'error', 'ACCOUNT_DEACTIVATED');
  end if;
  if p.banned_at is not null then return jsonb_build_object('ok', false, 'error', 'ACCOUNT_BANNED'); end if;
  if p.suspended_until is not null and p.suspended_until > now() then
    return jsonb_build_object('ok', false, 'error', 'POSTING_SUSPENDED');
  end if;

  -- A task taken down by a moderator stays down; the owner can repost a corrected version.
  -- (A rejected *edit* only discarded the proposed text, so it does not count.)
  if t.status = 'inactive' and exists (
    select 1 from public.moderation_items mi
     where mi.task_id = t.id
       and mi.content_type = 'task'
       and mi.status = 'rejected'
       and (mi.details->'pending_edit' is null or jsonb_typeof(mi.details->'pending_edit') <> 'object')
  ) then
    return jsonb_build_object('ok', false, 'error', 'TASK_REJECTED');
  end if;

  update public.tasks
     set status = 'active',
         freshness_prompt_at = null,
         confirmed_at = now(),
         expires_at = greatest(expires_at, now() + interval '30 days')
   where id = _task_id;

  -- Unread reminders about this task are out of date now.
  delete from public.notifications
   where task_id = _task_id
     and read_at is null
     and type in ('task_freshness', 'task_expiring', 'task_expired');

  return jsonb_build_object('ok', true, 'expires_at', greatest(t.expires_at, now() + interval '30 days'));
end;
$function$;

revoke all on function public.confirm_task_active(uuid) from public, anon;
grant execute on function public.confirm_task_active(uuid) to authenticated;

create or replace function public.sweep_expiry_notifications(_batch integer default 500)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _n integer := 0; _c integer;
begin
  -- Day 3: gentle reminder to close the task once it is assigned (once per task).
  with c as (
    select t.id, t.user_id, t.title from public.tasks t
    where t.status = 'active' and t.deleted_at is null and t.created_at < now() - interval '3 days'
      and not exists (select 1 from public.notifications n where n.task_id = t.id and n.type = 'task_still_open')
    order by t.created_at limit _batch
  ), ins as (
    insert into public.notifications (user_id, type, title, body, link, task_id)
    select c.user_id, 'task_still_open', 'Още ли търсиш изпълнител?',
      'Ако вече си възложил „' || c.title || '“, затвори задачата. Така специалистите няма да харчат точки напразно.',
      '/task/' || c.id::text, c.id from c returning 1
  ) select count(*) into _c from ins; _n := _n + _c;

  -- 14 days since it was posted, bumped or last confirmed: ask whether it is still open.
  with c as (
    select t.id, t.user_id, t.title from public.tasks t
    where t.status = 'active' and t.deleted_at is null and t.freshness_prompt_at is null
      and greatest(t.created_at, coalesce(t.bumped_at, t.created_at), coalesce(t.confirmed_at, t.created_at))
          < now() - interval '14 days'
    order by t.created_at limit _batch for update
  ), upd as (
    update public.tasks t set freshness_prompt_at = now() from c where t.id = c.id returning t.id
  ), ins as (
    insert into public.notifications (user_id, type, title, body, link, task_id)
    select c.user_id, 'task_freshness', 'Задачата ти още ли е актуална?',
      'Отвори „' || c.title || '“ и натисни „Да, още е актуална“. Без потвърждение я деактивираме след 7 дни.',
      '/task/' || c.id::text, c.id from c join upd on upd.id = c.id returning 1
  ) select count(*) into _c from ins; _n := _n + _c;

  -- No answer within 7 days: deactivate and tell the owner how to bring it back.
  with c as (
    select id from public.tasks
    where status = 'active' and deleted_at is null and freshness_prompt_at is not null
      and freshness_prompt_at < now() - interval '7 days'
    order by freshness_prompt_at limit _batch for update
  ), upd as (
    update public.tasks t set status = 'inactive' from c where t.id = c.id
    returning t.id, t.user_id, t.title
  ), ins as (
    insert into public.notifications (user_id, type, title, body, link, task_id)
    select upd.user_id, 'task_expired', 'Задачата ти е деактивирана',
      'Не потвърди, че „' || upd.title || '“ е актуална, затова вече не се показва. Можеш да я активираш отново от профила си, раздел „Архив“.',
      '/task/' || upd.id::text, upd.id from upd returning 1
  ) select count(*) into _c from ins; _n := _n + _c;

  -- 3 days before the 30-day end.
  with c as (
    select t.id, t.user_id, t.title from public.tasks t
    where t.status = 'active' and t.deleted_at is null and t.expires_at between now() and now() + interval '3 days'
      and not exists (select 1 from public.notifications n
        where n.task_id = t.id and n.type = 'task_expiring' and n.created_at > now() - interval '3 days')
    order by t.expires_at limit _batch
  ), ins as (
    insert into public.notifications (user_id, type, title, body, link, task_id)
    select c.user_id, 'task_expiring', 'Задачата ти изтича скоро',
      'Задачата „' || c.title || '“ изтича след по-малко от 3 дни. Ако още търсиш изпълнител, отвори я и натисни „Удължи с 30 дни“.',
      '/task/' || c.id::text, c.id
    from c returning 1
  ) select count(*) into _c from ins; _n := _n + _c;

  -- 30 days are over: notify (once per activation) ...
  with c as (
    select t.id, t.user_id, t.title from public.tasks t
    where t.status = 'active' and t.deleted_at is null and t.expires_at < now()
      and not exists (select 1 from public.notifications n
        where n.task_id = t.id and n.type = 'task_expired' and n.created_at > t.status_changed_at)
    order by t.expires_at limit _batch
  ), ins as (
    insert into public.notifications (user_id, type, title, body, link, task_id)
    select c.user_id, 'task_expired', 'Задачата ти изтече',
      'Задачата „' || c.title || '“ изтече и вече не се показва. Можеш да я активираш отново от профила си, раздел „Архив“.',
      '/task/' || c.id::text, c.id
    from c returning 1
  ) select count(*) into _c from ins; _n := _n + _c;

  -- ... and deactivate.
  with c as (
    select id from public.tasks where status = 'active' and deleted_at is null and expires_at < now()
    order by expires_at limit _batch
  ), upd as (
    update public.tasks t set status = 'inactive' from c where t.id = c.id returning 1
  ) select count(*) into _c from upd; _n := _n + _c;

  -- Promotion ends tomorrow.
  with c as (
    select p.user_id, p.task_id from public.task_promotions p
    join public.tasks t on t.id = p.task_id
    where p.expires_at between now() and now() + interval '1 day'
      and t.status = 'active' and t.deleted_at is null
      and not exists (select 1 from public.notifications n
        where n.task_id = p.task_id and n.type = 'promo_expiring' and n.created_at > now() - interval '1 day')
    order by p.expires_at limit _batch
  ), ins as (
    insert into public.notifications (user_id, type, title, body, link, task_id)
    select c.user_id, 'promo_expiring', 'Промоцията ти изтича утре',
      'Промоцията по задачата ти изтича след по-малко от 24 часа.', '/task/' || c.task_id::text, c.task_id
    from c returning 1
  ) select count(*) into _c from ins; _n := _n + _c;

  return _n;
end;
$function$;

revoke all on function public.sweep_expiry_notifications(integer) from public, anon, authenticated;
grant execute on function public.sweep_expiry_notifications(integer) to service_role;
