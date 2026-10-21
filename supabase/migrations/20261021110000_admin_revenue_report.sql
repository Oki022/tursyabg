-- Monthly revenue report for the admin panel (/admin/reports): totals per
-- month and the list of payments behind them, for the accountant and NAP.
-- Months follow Bulgarian time. A sale counts in the month it was paid
-- (completed_at); a refund or dispute counts in the month it happened
-- (refunded_at), so a refunded sale shows up in both months, as in the books.
-- Admins only (not moderators).

create or replace function public.admin_revenue_months(_months integer default 12)
returns table(
  month date,
  sales_count integer,
  sales_eur numeric,
  credits_eur numeric,
  promotion_eur numeric,
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
      sum(p.amount_eur) filter (where p.kind = 'promotion') as promotion_total
    from public.payments p
    where p.completed_at is not null
      and p.status in ('completed', 'refunded', 'disputed')
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
    group by 1
  )
  select mo.m,
    coalesce(s.cnt, 0),
    coalesce(s.total, 0)::numeric,
    coalesce(s.credits_total, 0)::numeric,
    coalesce(s.promotion_total, 0)::numeric,
    coalesce(r.cnt, 0),
    coalesce(r.total, 0)::numeric,
    (coalesce(s.total, 0) - coalesce(r.total, 0))::numeric
  from months mo
  left join sales s on s.m = mo.m
  left join refunds r on r.m = mo.m
  order by mo.m desc;
end;
$$;

-- Every payment paid or refunded in the given month (any day of that month).
create or replace function public.admin_revenue_payments(_month date)
returns table(
  id uuid,
  paid_at timestamptz,
  refunded_at timestamptz,
  status text,
  kind text,
  item text,
  credits integer,
  amount_eur numeric,
  currency text,
  user_id uuid,
  user_name text,
  stripe_payment_intent_id text,
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
    coalesce(cp.name, pp.name_bg, '')::text,
    coalesce(p.credits, 0)::integer,
    p.amount_eur,
    p.currency,
    p.user_id,
    coalesce(pr.full_name, '')::text,
    p.stripe_payment_intent_id,
    p.receipt_url
  from public.payments p
  left join public.credit_packages cp on cp.id = p.package_id
  left join public.promo_products pp on pp.id = p.promo_product_id
  left join public.profiles pr on pr.id = p.user_id
  where p.completed_at is not null
    and p.status in ('completed', 'refunded', 'disputed')
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
