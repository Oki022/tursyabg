-- In-app purchases in the mobile app (Google Play now, App Store later),
-- verified by RevenueCat and reported to /api/public/payments/revenuecat.
-- Prices are the same as on the site; the store takes its commission, which is
-- stored per payment for the accountant. Test purchases (store sandbox) are
-- kept but marked test_mode and left out of the revenue report.

-- 1. Payments: store references.
alter table public.payments
  add column if not exists store_transaction_id text,
  add column if not exists store_product_id text,
  add column if not exists store_price numeric(10,2),
  add column if not exists store_currency text,
  add column if not exists store_commission_pct numeric(5,4),
  add column if not exists test_mode boolean not null default false;

create unique index if not exists payments_store_transaction
  on public.payments (provider, store_transaction_id)
  where store_transaction_id is not null;

-- 2. Product ids in Google Play / App Store (lowercase letters, digits, _ and .).
alter table public.credit_packages add column if not exists store_product_id text;
alter table public.promo_products add column if not exists store_product_id text;
create unique index if not exists credit_packages_store_product on public.credit_packages (store_product_id)
  where store_product_id is not null;
create unique index if not exists promo_products_store_product on public.promo_products (store_product_id)
  where store_product_id is not null;

update public.credit_packages
set store_product_id = 'points_' || credits
where store_product_id is null;

update public.promo_products
set store_product_id = 'promo_' || regexp_replace(lower(code), '[^a-z0-9_.]', '_', 'g')
where store_product_id is null;

-- 3. A store purchase confirmed by RevenueCat (idempotent per transaction).
--    Points are added at once; a promotion is recorded as paid and applied to
--    the task when the app calls apply_store_promotion.
create or replace function public.complete_store_purchase(
  _provider text,
  _transaction_id text,
  _user_id uuid,
  _product_id text,
  _price numeric,
  _currency text,
  _commission_pct numeric,
  _purchased_at timestamptz,
  _test_mode boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _existing public.payments%rowtype;
  _pkg public.credit_packages%rowtype;
  _promo public.promo_products%rowtype;
  _amount numeric(10,2);
  _payment_id uuid;
  _balance integer;
begin
  if _provider not in ('google_play', 'app_store') or coalesce(_transaction_id, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into _existing from public.payments
  where provider = _provider and store_transaction_id = _transaction_id;
  if found then
    return jsonb_build_object('ok', true, 'already', true, 'payment_id', _existing.id);
  end if;

  if not exists (select 1 from public.profiles where id = _user_id) then
    return jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  end if;

  select * into _pkg from public.credit_packages where store_product_id = _product_id;
  if found then
    _amount := case when upper(coalesce(_currency, '')) = 'EUR' and _price is not null then _price else _pkg.price_eur end;

    insert into public.payments (user_id, kind, package_id, credits, amount_eur, currency, provider, status,
      completed_at, store_transaction_id, store_product_id, store_price, store_currency, store_commission_pct, test_mode)
    values (_user_id, 'credits', _pkg.id, _pkg.credits, _amount, 'EUR', _provider, 'completed',
      coalesce(_purchased_at, now()), _transaction_id, _product_id, _price, upper(_currency), _commission_pct,
      coalesce(_test_mode, false))
    returning id into _payment_id;

    update public.profiles set credits = credits + _pkg.credits
    where id = _user_id
    returning credits into _balance;

    insert into public.credit_transactions (user_id, amount, type, package_id, balance_after, description)
    values (_user_id, _pkg.credits, 'purchase', _pkg.id, _balance, 'Покупка на точки');

    return jsonb_build_object('ok', true, 'already', false, 'kind', 'credits', 'payment_id', _payment_id,
      'balance', _balance);
  end if;

  select * into _promo from public.promo_products where store_product_id = _product_id;
  if found then
    _amount := case when upper(coalesce(_currency, '')) = 'EUR' and _price is not null then _price else _promo.price_eur end;

    insert into public.payments (user_id, kind, promo_product_id, credits, amount_eur, currency, provider, status,
      completed_at, store_transaction_id, store_product_id, store_price, store_currency, store_commission_pct, test_mode)
    values (_user_id, 'promotion', _promo.id, 0, _amount, 'EUR', _provider, 'completed',
      coalesce(_purchased_at, now()), _transaction_id, _product_id, _price, upper(_currency), _commission_pct,
      coalesce(_test_mode, false))
    returning id into _payment_id;

    return jsonb_build_object('ok', true, 'already', false, 'kind', 'promotion', 'payment_id', _payment_id);
  end if;

  return jsonb_build_object('ok', false, 'error', 'UNKNOWN_PRODUCT');
end;
$$;

-- 4. Refund of a store purchase. The points taken back never go below 0, and
--    the ledger records exactly what was taken, so balance and history match.
create or replace function public.refund_store_purchase(_provider text, _transaction_id text, _status text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p public.payments%rowtype;
  _before integer;
  _after integer;
begin
  select * into p from public.payments
  where provider = _provider and store_transaction_id = _transaction_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_FOUND');
  end if;
  if p.status in ('refunded', 'disputed') then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if p.kind = 'credits' and p.credits > 0 then
    select credits into _before from public.profiles where id = p.user_id for update;
    update public.profiles set credits = greatest(credits - p.credits, 0)
    where id = p.user_id
    returning credits into _after;

    if _after <> _before then
      insert into public.credit_transactions (user_id, amount, type, package_id, balance_after, description)
      values (p.user_id, _after - _before, 'refund', p.package_id, _after,
        'Възстановено плащане — точките са отнети');
    end if;
  end if;

  update public.payments set status = coalesce(nullif(_status, ''), 'refunded'), refunded_at = now()
  where id = p.id;

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

-- 5. The app applies a paid promotion to the user's task. Called by the
--    signed-in user; only their own paid, unused promotion and their own task.
create or replace function public.apply_store_promotion(_transaction_id text, _task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _uid uuid := auth.uid();
  p public.payments%rowtype;
  prod public.promo_products%rowtype;
  _expires timestamptz;
  _promo_id uuid;
begin
  if _uid is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;

  select * into p from public.payments
  where provider in ('google_play', 'app_store')
    and store_transaction_id = _transaction_id
    and user_id = _uid
    and kind = 'promotion'
  for update;
  if not found then
    -- The store confirmation may still be on its way: the app retries.
    return jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_FOUND');
  end if;
  if p.status <> 'completed' then
    return jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_COMPLETED');
  end if;
  if p.task_id is not null then
    if p.task_id = _task_id then
      return jsonb_build_object('ok', true, 'already', true);
    end if;
    return jsonb_build_object('ok', false, 'error', 'ALREADY_USED');
  end if;

  if not exists (
    select 1 from public.tasks t
    where t.id = _task_id and t.user_id = _uid and t.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND');
  end if;

  select * into prod from public.promo_products where id = p.promo_product_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'PROMO_NOT_FOUND');
  end if;

  -- Same activation as the card payment (complete_promotion_payment).
  if prod.type = 'bump' then
    update public.tasks set bumped_at = now() where id = _task_id;
    _expires := now();
  else
    select greatest(now(), coalesce(max(tp.expires_at), now())) into _expires
    from public.task_promotions tp
    where tp.task_id = _task_id and tp.type = prod.type and tp.expires_at > now();
    _expires := _expires + make_interval(days => prod.duration_days);
  end if;

  insert into public.task_promotions (task_id, user_id, promo_product_id, type, starts_at, expires_at, price_paid_eur)
  values (_task_id, _uid, prod.id, prod.type, now(), _expires, p.amount_eur)
  returning id into _promo_id;

  update public.payments set task_id = _task_id where id = p.id;

  return jsonb_build_object('ok', true, 'already', false, 'promotion_id', _promo_id, 'expires_at', _expires);
end;
$$;

revoke all on function public.complete_store_purchase(text, text, uuid, text, numeric, text, numeric, timestamptz, boolean)
  from public, anon, authenticated;
revoke all on function public.refund_store_purchase(text, text, text) from public, anon, authenticated;
revoke all on function public.apply_store_promotion(text, uuid) from public, anon;
grant execute on function public.complete_store_purchase(text, text, uuid, text, numeric, text, numeric, timestamptz, boolean)
  to service_role;
grant execute on function public.refund_store_purchase(text, text, text) to service_role;
grant execute on function public.apply_store_promotion(text, uuid) to authenticated;

-- 6. Revenue report by channel (site / Google Play / App Store), without test
--    purchases. The return columns change, so the functions are recreated.
drop function if exists public.admin_revenue_months(integer);
drop function if exists public.admin_revenue_payments(date);

create function public.admin_revenue_months(_months integer default 12)
returns table(
  month date,
  sales_count integer,
  sales_eur numeric,
  credits_eur numeric,
  promotion_eur numeric,
  site_eur numeric,
  google_play_eur numeric,
  app_store_eur numeric,
  store_commission_eur numeric,
  refunds_count integer,
  refunds_eur numeric,
  net_eur numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _this_month date := date_trunc('month', now() at time zone 'Europe/Sofia')::date;
  _n integer := least(greatest(coalesce(_months, 12), 1), 60);
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  with months as (
    select (_this_month - make_interval(months => i))::date as m
    from generate_series(0, _n - 1) as i
  ),
  sales as (
    select date_trunc('month', p.completed_at at time zone 'Europe/Sofia')::date as m,
      count(*)::integer as cnt,
      sum(p.amount_eur) as total,
      sum(p.amount_eur) filter (where p.kind = 'credits') as credits_total,
      sum(p.amount_eur) filter (where p.kind = 'promotion') as promotion_total,
      sum(p.amount_eur) filter (where p.provider not in ('google_play', 'app_store')) as site_total,
      sum(p.amount_eur) filter (where p.provider = 'google_play') as play_total,
      sum(p.amount_eur) filter (where p.provider = 'app_store') as apple_total,
      sum(p.amount_eur * coalesce(p.store_commission_pct, 0)) as commission_total
    from public.payments p
    where p.completed_at is not null
      and p.status in ('completed', 'refunded', 'disputed')
      and not p.test_mode
    group by 1
  ),
  refunds as (
    select date_trunc('month', p.refunded_at at time zone 'Europe/Sofia')::date as m,
      count(*)::integer as cnt,
      sum(p.amount_eur) as total
    from public.payments p
    where p.refunded_at is not null
      and p.completed_at is not null
      and p.status in ('refunded', 'disputed')
      and not p.test_mode
    group by 1
  )
  select mo.m,
    coalesce(s.cnt, 0),
    coalesce(s.total, 0)::numeric,
    coalesce(s.credits_total, 0)::numeric,
    coalesce(s.promotion_total, 0)::numeric,
    coalesce(s.site_total, 0)::numeric,
    coalesce(s.play_total, 0)::numeric,
    coalesce(s.apple_total, 0)::numeric,
    round(coalesce(s.commission_total, 0), 2)::numeric,
    coalesce(r.cnt, 0),
    coalesce(r.total, 0)::numeric,
    (coalesce(s.total, 0) - coalesce(r.total, 0))::numeric
  from months mo
  left join sales s on s.m = mo.m
  left join refunds r on r.m = mo.m
  order by mo.m desc;
end;
$$;

create function public.admin_revenue_payments(_month date)
returns table(
  id uuid,
  paid_at timestamptz,
  refunded_at timestamptz,
  status text,
  kind text,
  provider text,
  item text,
  credits integer,
  amount_eur numeric,
  currency text,
  store_commission_pct numeric,
  user_id uuid,
  user_name text,
  stripe_payment_intent_id text,
  store_transaction_id text,
  receipt_url text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _from date := date_trunc('month', coalesce(_month, now()::date))::date;
  _to date := (date_trunc('month', coalesce(_month, now()::date)) + interval '1 month')::date;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select p.id,
    p.completed_at,
    case when p.status in ('refunded', 'disputed') then p.refunded_at end,
    p.status,
    p.kind,
    p.provider,
    coalesce(cp.name, pp.name_bg, '')::text,
    coalesce(p.credits, 0)::integer,
    p.amount_eur,
    p.currency,
    p.store_commission_pct,
    p.user_id,
    coalesce(pr.full_name, '')::text,
    p.stripe_payment_intent_id,
    p.store_transaction_id,
    p.receipt_url
  from public.payments p
  left join public.credit_packages cp on cp.id = p.package_id
  left join public.promo_products pp on pp.id = p.promo_product_id
  left join public.profiles pr on pr.id = p.user_id
  where p.completed_at is not null
    and p.status in ('completed', 'refunded', 'disputed')
    and not p.test_mode
    and (
      ((p.completed_at at time zone 'Europe/Sofia')::date >= _from
        and (p.completed_at at time zone 'Europe/Sofia')::date < _to)
      or (p.status in ('refunded', 'disputed') and p.refunded_at is not null
        and (p.refunded_at at time zone 'Europe/Sofia')::date >= _from
        and (p.refunded_at at time zone 'Europe/Sofia')::date < _to)
    )
  order by p.completed_at;
end;
$$;

revoke all on function public.admin_revenue_months(integer) from public, anon;
revoke all on function public.admin_revenue_payments(date) from public, anon;
grant execute on function public.admin_revenue_months(integer) to authenticated;
grant execute on function public.admin_revenue_payments(date) to authenticated;

notify pgrst, 'reload schema';
