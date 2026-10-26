-- Expiring points
--
--  * Bonus points (the welcome bonus) expire 30 days after they were given.
--  * All points (bought ones too) expire only after 12 months without any
--    activity in the account. Using the site or the app keeps them.
--  * 7 days before, the user gets a notification (bell + phone) and an e-mail.
--  * Spending uses bonus points first, then bought points (oldest first).
--
-- How: every balance change already writes a row to credit_transactions (the
-- admin check "credit mismatches" relies on that). A trigger on that table
-- keeps "credit_lots": where the points came from and how many are left.
-- None of the existing payment / unlock / refund functions change.
-- Points that existed before this migration become one "paid" lot, so nobody
-- loses points because of this change.
--
-- Settings (app_settings): credits_expiry_enabled, credits_bonus_valid_days,
-- credits_inactivity_days, credits_expiry_warning_days.

-- 1. Settings ---------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  ('credits_expiry_enabled', 'true'::jsonb,
   'Изтичане на точки: бонус точките след credits_bonus_valid_days, всички точки след credits_inactivity_days без активност.'),
  ('credits_bonus_valid_days', '30'::jsonb, 'Колко дни са валидни бонус точките (подарък при регистрация).'),
  ('credits_inactivity_days', '365'::jsonb, 'След колко дни без активност в профила изтичат всички точки.'),
  ('credits_expiry_warning_days', '7'::jsonb, 'Колко дни преди изтичане на точки пращаме известие и имейл.')
on conflict (key) do nothing;

-- 2. Lots: where the points came from and how many are left -----------------
create table if not exists public.credit_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('paid', 'bonus')),
  amount integer not null check (amount > 0),
  remaining integer not null check (remaining >= 0 and remaining <= amount),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  source_tx uuid references public.credit_transactions(id) on delete set null,
  warned_at timestamptz
);
create index if not exists credit_lots_user_open on public.credit_lots (user_id) where remaining > 0;
create index if not exists credit_lots_bonus_open on public.credit_lots (expires_at)
  where kind = 'bonus' and remaining > 0;

alter table public.credit_lots enable row level security;
revoke all on public.credit_lots from anon, authenticated;
grant select, insert, update, delete on public.credit_lots to service_role;

-- 3. Keep lots in step with every ledger row --------------------------------
create or replace function public.credit_lots_from_ledger()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _need integer;
  _take integer;
  _lot record;
  _is_bonus boolean;
begin
  -- Expiry rows are written by sweep_credit_expiry, which updates the lots itself.
  if new.type = 'expire' or new.amount = 0 then
    return null;
  end if;

  begin
    if new.amount > 0 then
      -- Only the welcome bonus expires; admin corrections and refunds do not.
      _is_bonus := new.type = 'bonus'
        and new.description in ('Бонус точки за нова регистрация', 'Бонус кредити за нова регистрация');
      insert into public.credit_lots (user_id, kind, amount, remaining, created_at, expires_at, source_tx)
      values (
        new.user_id,
        case when _is_bonus then 'bonus' else 'paid' end,
        new.amount,
        new.amount,
        new.created_at,
        case when _is_bonus
          then new.created_at + make_interval(days => public.app_setting_int('credits_bonus_valid_days', 30))
        end,
        new.id
      );
      return null;
    end if;

    -- Spending: bonus points first (the soonest to expire), then the oldest bought ones.
    _need := -new.amount;
    for _lot in
      select id, remaining
      from public.credit_lots
      where user_id = new.user_id and remaining > 0
      order by (kind = 'bonus') desc, expires_at asc nulls last, created_at, id
      for update
    loop
      exit when _need <= 0;
      _take := least(_need, _lot.remaining);
      update public.credit_lots set remaining = remaining - _take where id = _lot.id;
      _need := _need - _take;
    end loop;
  exception when others then
    -- A problem here must never undo a payment, an unlock or a refund.
    raise warning 'credit_lots_from_ledger %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.credit_lots_from_ledger() from public, anon, authenticated;

-- Existing balances become one paid lot each (they never expire except by
-- inactivity), and the trigger starts, in one step: no points movement can
-- slip in between (the ledger is locked for this short moment).
do $$
begin
  lock table public.credit_transactions in share row exclusive mode;

  insert into public.credit_lots (user_id, kind, amount, remaining, created_at)
  select p.id, 'paid', p.credits, p.credits, now()
  from public.profiles p
  where p.credits > 0
    and not exists (select 1 from public.credit_lots l where l.user_id = p.id);

  drop trigger if exists trg_credit_lots_from_ledger on public.credit_transactions;
  create trigger trg_credit_lots_from_ledger
    after insert on public.credit_transactions
    for each row execute function public.credit_lots_from_ledger();
end $$;

-- 4. Activity: visiting the site or the app counts --------------------------
create table if not exists public.user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_active_at timestamptz not null default now()
);
alter table public.user_activity enable row level security;
revoke all on public.user_activity from anon, authenticated;
grant select, insert, update, delete on public.user_activity to service_role;

create or replace function public.touch_my_activity()
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.user_activity (user_id, last_active_at)
  select auth.uid(), now()
  where auth.uid() is not null
  on conflict (user_id) do update
    set last_active_at = now()
    where public.user_activity.last_active_at < now() - interval '1 hour';
$$;
revoke all on function public.touch_my_activity() from public, anon;
grant execute on function public.touch_my_activity() to authenticated;

-- Latest sign of life: a visit, a points movement, a sign-in, the app,
-- a task, a message, or the registration itself.
create or replace function public.credit_last_activity(_uid uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'public'
as $$
  select greatest(
    (select a.last_active_at from public.user_activity a where a.user_id = _uid),
    (select max(t.created_at) from public.credit_transactions t where t.user_id = _uid and t.type <> 'expire'),
    (select u.last_sign_in_at from auth.users u where u.id = _uid),
    (select max(d.last_seen_at) from public.push_devices d where d.user_id = _uid),
    (select max(k.created_at) from public.tasks k where k.user_id = _uid),
    (select max(m.created_at) from public.messages m where m.sender_id = _uid),
    (select p.created_at from public.profiles p where p.id = _uid)
  );
$$;
revoke all on function public.credit_last_activity(uuid) from public, anon, authenticated;

-- The same for everyone who holds points, in one pass (nightly job).
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);

create or replace function public.credit_holders_last_activity()
returns table (user_id uuid, credits integer, anonymized boolean, last_active timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  with holders as (
    select p.id, p.credits, p.anonymized_at is not null as anonymized, p.created_at
    from public.profiles p
    where p.credits > 0
  ),
  acts as (
    select h.id as user_id, h.created_at as t from holders h
    union all
    select a.user_id, a.last_active_at from public.user_activity a join holders h on h.id = a.user_id
    union all
    select t.user_id, max(t.created_at) from public.credit_transactions t
      join holders h on h.id = t.user_id where t.type <> 'expire' group by t.user_id
    union all
    select u.id, u.last_sign_in_at from auth.users u join holders h on h.id = u.id
    union all
    select d.user_id, max(d.last_seen_at) from public.push_devices d
      join holders h on h.id = d.user_id group by d.user_id
    union all
    select k.user_id, max(k.created_at) from public.tasks k
      join holders h on h.id = k.user_id group by k.user_id
    union all
    select m.sender_id, max(m.created_at) from public.messages m
      join holders h on h.id = m.sender_id group by m.sender_id
  )
  select h.id, h.credits, h.anonymized, max(a.t)
  from holders h
  join acts a on a.user_id = h.id
  group by h.id, h.credits, h.anonymized;
$$;
revoke all on function public.credit_holders_last_activity() from public, anon, authenticated;

-- 5. Expiry (nightly) -------------------------------------------------------
create or replace function public.sweep_credit_expiry(_limit integer default 1000)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _n integer := 0;
  _uid uuid;
  _sum integer;
  _credits integer;
  _delta integer;
  _balance integer;
  _days integer := public.app_setting_int('credits_inactivity_days', 365);
  _bonus_days integer := public.app_setting_int('credits_bonus_valid_days', 30);
begin
  if not public.app_setting_bool('credits_expiry_enabled', true) then
    return 0;
  end if;

  -- a) Bonus points past their date.
  for _uid in
    select l.user_id
    from public.credit_lots l
    where l.kind = 'bonus' and l.remaining > 0 and l.expires_at <= now()
    group by l.user_id
    limit _limit
  loop
    -- Same lock order as payments and unlocks: the profile first, then the lots.
    select credits into _credits from public.profiles where id = _uid for update;
    if _credits is null then
      continue;
    end if;

    select coalesce(sum(remaining), 0)::integer into _sum
    from (
      select remaining from public.credit_lots
      where user_id = _uid and kind = 'bonus' and remaining > 0 and expires_at <= now()
      for update
    ) open_lots;

    update public.credit_lots
       set remaining = 0
     where user_id = _uid and kind = 'bonus' and remaining > 0 and expires_at <= now();

    _delta := least(_sum, greatest(_credits, 0));
    if _delta > 0 then
      update public.profiles set credits = credits - _delta where id = _uid returning credits into _balance;
      insert into public.credit_transactions (user_id, amount, type, balance_after, description)
      values (_uid, -_delta, 'expire', _balance,
              'Изтекли бонус точки (валидни ' || _bonus_days || ' дни)');
      _n := _n + 1;
    end if;
  end loop;

  -- b) Everything, after a long time without any activity.
  for _uid in
    select h.user_id
    from public.credit_holders_last_activity() h
    where h.last_active < now() - make_interval(days => _days)
    limit _limit
  loop
    select credits into _credits from public.profiles where id = _uid for update;
    -- Check again after the lock: the user may have just come back.
    if coalesce(_credits, 0) <= 0
       or public.credit_last_activity(_uid) >= now() - make_interval(days => _days) then
      continue;
    end if;

    perform 1 from public.credit_lots where user_id = _uid and remaining > 0 for update;
    update public.credit_lots set remaining = 0 where user_id = _uid and remaining > 0;
    update public.profiles set credits = 0 where id = _uid;
    insert into public.credit_transactions (user_id, amount, type, balance_after, description)
    values (_uid, -_credits, 'expire', 0,
            'Точките изтекоха след ' || _days || ' дни без активност в профила');
    _n := _n + 1;
  end loop;

  return _n;
end;
$$;
revoke all on function public.sweep_credit_expiry(integer) from public, anon, authenticated;

-- 6. Warnings 7 days before (nightly) ---------------------------------------
create table if not exists public.credit_expiry_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bonus', 'inactivity')),
  amount integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  emailed_at timestamptz
);
-- One warning per user, kind and expiry day.
create unique index if not exists credit_expiry_notices_once
  on public.credit_expiry_notices (user_id, kind, ((expires_at at time zone 'UTC')::date));
create index if not exists credit_expiry_notices_to_email
  on public.credit_expiry_notices (created_at) where emailed_at is null;

alter table public.credit_expiry_notices enable row level security;
revoke all on public.credit_expiry_notices from anon, authenticated;
grant select, insert, update, delete on public.credit_expiry_notices to service_role;

create or replace function public.sofia_date(_t timestamptz)
returns text
language sql
stable
set search_path to 'public'
as $$
  select to_char(_t at time zone 'Europe/Sofia', 'DD.MM.YYYY');
$$;

create or replace function public.warn_credit_expiry(_limit integer default 1000)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _n integer := 0;
  _r record;
  _notice uuid;
  _warn integer := public.app_setting_int('credits_expiry_warning_days', 7);
  _days integer := public.app_setting_int('credits_inactivity_days', 365);
begin
  if not public.app_setting_bool('credits_expiry_enabled', true) then
    return 0;
  end if;

  -- a) Bonus points that expire within the next days.
  for _r in
    select l.user_id, sum(l.remaining)::integer as amount, min(l.expires_at) as expires_at,
           array_agg(l.id) as lot_ids
    from public.credit_lots l
    join public.profiles p on p.id = l.user_id
    where l.kind = 'bonus' and l.remaining > 0 and l.warned_at is null
      and l.expires_at > now() and l.expires_at <= now() + make_interval(days => _warn)
      and p.anonymized_at is null
    group by l.user_id
    limit _limit
  loop
    update public.credit_lots set warned_at = now() where id = any(_r.lot_ids);
    _notice := null;
    insert into public.credit_expiry_notices (user_id, kind, amount, expires_at)
    values (_r.user_id, 'bonus', _r.amount, _r.expires_at)
    on conflict do nothing
    returning id into _notice;
    if _notice is not null then
      perform public.push_notification(
        _r.user_id, 'credits_expiring'::public.notification_type,
        'Бонус точките ти изтичат',
        _r.amount || ' бонус точки изтичат на ' || public.sofia_date(_r.expires_at)
          || '. Използвай ги, за да отключиш контакт по задача, която те интересува.',
        '/tasks', null);
      _n := _n + 1;
    end if;
  end loop;

  -- b) All points, when the account has been quiet for almost the whole period.
  for _r in
    select h.user_id, h.credits as amount, h.last_active + make_interval(days => _days) as expires_at
    from public.credit_holders_last_activity() h
    where not h.anonymized
      and h.last_active + make_interval(days => _days) > now()
      and h.last_active + make_interval(days => _days) <= now() + make_interval(days => _warn)
    limit _limit
  loop
    _notice := null;
    insert into public.credit_expiry_notices (user_id, kind, amount, expires_at)
    values (_r.user_id, 'inactivity', _r.amount, _r.expires_at)
    on conflict do nothing
    returning id into _notice;
    if _notice is not null then
      perform public.push_notification(
        _r.user_id, 'credits_expiring'::public.notification_type,
        'Точките ти изтичат',
        _r.amount || ' точки изтичат на ' || public.sofia_date(_r.expires_at)
          || ', защото профилът ти няма активност от почти ' || _days || ' дни. Достатъчно е да влезеш в ТърсяБГ, за да ги запазиш.',
        '/settings/billing', null);
      _n := _n + 1;
    end if;
  end loop;

  return _n;
end;
$$;
revoke all on function public.warn_credit_expiry(integer) from public, anon, authenticated;

-- 7. E-mails (sent by /api/public/cron/credit-expiry-emails) ----------------
create or replace function public.credit_expiry_email_batch(_limit integer default 200)
returns table (notice_id uuid, email text, full_name text, kind text, amount integer, expires_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select n.id, u.email::text, p.full_name, n.kind, n.amount, n.expires_at
  from public.credit_expiry_notices n
  join auth.users u on u.id = n.user_id
  left join public.profiles p on p.id = n.user_id
  where n.emailed_at is null
    and n.created_at > now() - interval '3 days'
    and n.expires_at > now()
    and u.email is not null
    and (p.anonymized_at is null)
  order by n.created_at
  limit _limit;
$$;

create or replace function public.mark_credit_expiry_emailed(_ids uuid[])
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.credit_expiry_notices set emailed_at = now()
  where id = any(_ids) and emailed_at is null;
$$;

revoke all on function public.credit_expiry_email_batch(integer) from public, anon, authenticated;
revoke all on function public.mark_credit_expiry_emailed(uuid[]) from public, anon, authenticated;
grant execute on function public.credit_expiry_email_batch(integer) to service_role;
grant execute on function public.mark_credit_expiry_emailed(uuid[]) to service_role;

-- 8. What the user sees on "Баланс и плащания" -------------------------------
create or replace function public.my_credit_expiry()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'enabled', public.app_setting_bool('credits_expiry_enabled', true),
    'bonus_amount', coalesce((
      select sum(l.remaining) from public.credit_lots l
      where l.user_id = auth.uid() and l.kind = 'bonus' and l.remaining > 0 and l.expires_at > now()), 0),
    'bonus_expires_at', (
      select min(l.expires_at) from public.credit_lots l
      where l.user_id = auth.uid() and l.kind = 'bonus' and l.remaining > 0 and l.expires_at > now()),
    'bonus_valid_days', public.app_setting_int('credits_bonus_valid_days', 30),
    'inactivity_days', public.app_setting_int('credits_inactivity_days', 365)
  )
  where auth.uid() is not null;
$$;
revoke all on function public.my_credit_expiry() from public, anon;
grant execute on function public.my_credit_expiry() to authenticated;

-- 9. Nightly job --------------------------------------------------------------
insert into public.cron_secrets (name) values ('credit_expiry') on conflict (name) do nothing;

create or replace function public.run_credit_expiry()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _run uuid;
  _rows integer := 0;
  _token text;
begin
  insert into public.cron_runs (job_name) values ('credit_expiry') returning id into _run;
  begin
    _rows := public.sweep_credit_expiry(1000);
    _rows := _rows + public.warn_credit_expiry(1000);
    update public.cron_runs set finished_at = now(), rows_processed = _rows where id = _run;
  exception when others then
    update public.cron_runs set finished_at = now(), error = sqlerrm where id = _run;
  end;

  -- Then the server sends the warning e-mails.
  select token into _token from public.cron_secrets where name = 'credit_expiry';
  if _token is not null then
    begin
      perform net.http_post(
        url := 'https://tursya.bg/api/public/cron/credit-expiry-emails',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', _token),
        body := '{}'::jsonb
      );
    exception when others then
      null;
    end;
  end if;
end;
$$;
revoke all on function public.run_credit_expiry() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'credit-expiry-daily';
  -- 07:20 UTC = 09:20 / 10:20 in Sofia.
  perform cron.schedule('credit-expiry-daily', '20 7 * * *', 'select public.run_credit_expiry()');
end $$;

-- 10. Welcome bonus notification: say how long the bonus is valid ----------
do $$
declare
  def text := pg_get_functiondef('public.grant_welcome_bonus(uuid)'::regprocedure);
  newdef text;
begin
  if def like '%валидни%' then
    return; -- already updated
  end if;
  newdef := replace(def, 'Виж как работят точките в помощния раздел.',
                         'Бонус точките са валидни 30 дни. Виж как работят точките в помощния раздел.');
  if newdef = def then
    raise notice 'grant_welcome_bonus: text not found, notification left as it was';
    return;
  end if;
  execute newdef;
end $$;

notify pgrst, 'reload schema';
