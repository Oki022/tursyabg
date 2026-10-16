-- Categories v2: two new categories (avto, grizha) and a revised list of
-- subcategories (src/lib/subcategories.ts). Old subcategory ids from
-- 20261016120000 are mapped to the new ones; car, machinery and road-help
-- tasks move to "avto", child and elderly care to "grizha".
-- Only test data used the old ids so far.

-- 1. Tasks: (category, subcategory) -> (category, subcategory)
with map(old_cat, old_sub, new_cat, new_sub) as (values
  ('remonti', 'boya-plochki-podove', 'remonti', 'boyadisvane'),
  ('remonti', 'dograma-pokrivi', 'remonti', 'dograma'),
  ('remonti', 'mebeli-montazh', 'remonti', 'mebeli'),
  ('remonti', 'bitova-tehnika', 'remonti', 'uredi'),
  ('remonti', 'avtomobili', 'avto', 'avtoservis'),
  ('remonti', 'selskostopanska-tehnika', 'avto', 'tezhka-tehnika'),
  ('pochistvane', 'deca', 'grizha', 'deca'),
  ('pochistvane', 'vazrastni', 'grizha', 'vazrastni'),
  ('gradina', 'darveta', 'gradina', 'rezitba'),
  ('prevoz', 'patna-pomosht', 'avto', 'patna-pomosht'),
  ('it', 'saitove-softuer', 'it', 'saitove'),
  ('uroci', 'muzika-izkustva', 'uroci', 'muzika'),
  ('uroci', 'shofyorski', 'uroci', 'kormuvane'),
  ('krasota-zdrave', 'grim-kozmetika', 'krasota-zdrave', 'grim'),
  ('domashni', 'razhodka-gledane', 'domashni', 'razhodka'),
  ('foto', 'foto', 'foto', 'fotograf'),
  ('foto', 'muzika-vodesht', 'foto', 'dj')
)
update public.tasks t
set category = m.new_cat, subcategory = m.new_sub
from map m
where t.category = m.old_cat and t.subcategory = m.old_sub;

-- 2. Saved searches: rename subcategory ids inside the same category; ids
-- that moved to another category are dropped.
do $$
declare
  a record;
  _subs text[];
begin
  for a in select id, category, subcategories from public.task_alerts where subcategories is not null loop
    select array_agg(distinct s order by s) into _subs
    from (
      select case a.category || ':' || x
        when 'remonti:boya-plochki-podove' then 'boyadisvane'
        when 'remonti:dograma-pokrivi' then 'dograma'
        when 'remonti:mebeli-montazh' then 'mebeli'
        when 'remonti:bitova-tehnika' then 'uredi'
        when 'remonti:avtomobili' then null
        when 'remonti:selskostopanska-tehnika' then null
        when 'pochistvane:deca' then null
        when 'pochistvane:vazrastni' then null
        when 'gradina:darveta' then 'rezitba'
        when 'prevoz:patna-pomosht' then null
        when 'it:saitove-softuer' then 'saitove'
        when 'uroci:muzika-izkustva' then 'muzika'
        when 'uroci:shofyorski' then 'kormuvane'
        when 'krasota-zdrave:grim-kozmetika' then 'grim'
        when 'domashni:razhodka-gledane' then 'razhodka'
        when 'foto:foto' then 'fotograf'
        when 'foto:muzika-vodesht' then 'dj'
        else x
      end as s
      from unnest(a.subcategories) x
    ) q
    where s is not null;

    -- Every chosen subcategory moved away: the search no longer means anything
    -- here (it must not silently widen to the whole category), so remove it.
    if coalesce(cardinality(_subs), 0) = 0 then
      delete from public.task_alerts where id = a.id;
      continue;
    end if;

    begin
      update public.task_alerts set subcategories = _subs where id = a.id;
    exception when unique_violation then
      -- The renamed search already exists for this user: keep the older one.
      delete from public.task_alerts where id = a.id;
    end;
  end loop;
end;
$$;
