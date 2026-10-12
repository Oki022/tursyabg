-- "Кредити" → "Точки" in every user-facing text the database produces.
--
-- Only wording changes: tables, columns, function names and amounts stay the
-- same. All texts in the functions use the plural/count form, which is
-- grammatically identical for "точки" (кредита/кредити → точки,
-- кредитите → точките), so a plain replace keeps the Bulgarian correct.

create function pg_temp.points_text(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(t,
    'Кредитите', 'Точките'),
    'кредитите', 'точките'),
    'Кредити',   'Точки'),
    'кредита',   'точки'),
    'кредити',   'точки');
$$;

-- 1. Functions: notification texts, transaction descriptions and the admin
--    stats filter that matches the welcome-bonus description.
do $$
declare
  f record;
  def text;
  newdef text;
begin
  for f in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and pg_get_functiondef(p.oid) ilike '%кредит%'
  loop
    def := pg_get_functiondef(f.oid);
    newdef := pg_temp.points_text(def);
    if newdef ilike '%кредит%' then
      raise exception 'Unhandled form of "кредит" left in function %', f.proname;
    end if;
    execute newdef;
  end loop;
end $$;

-- 2. Texts already stored, so history and old notifications read the same.
update public.notifications
set title = pg_temp.points_text(title),
    body  = pg_temp.points_text(body)
where title ilike '%кредит%' or body ilike '%кредит%';

do $$
begin
  update public.credit_transactions
  set description = pg_temp.points_text(description)
  where description ilike '%кредит%';
exception when others then
  -- The ledger may be protected against updates; old descriptions then stay as they are.
  raise notice 'credit_transactions not updated: %', sqlerrm;
end $$;