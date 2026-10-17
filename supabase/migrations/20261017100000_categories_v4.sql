-- Categories v4 (src/lib/subcategories.ts):
-- * "Ремонт на уреди" moves from "remonti" to "it" (ИТ и техника).
-- * "Пътна помощ" moves from "avto" to "prevoz" (Превоз и хамали).
-- * Removed: pochistvane/gladene, pochistvane/domashna-pomosht,
--   stroitelstvo/do-klyuch, gradina/ogradi.
-- * New: stroitelstvo/izkopni (no data to move).
-- Renames (Автоелектроника, Мотоциклети) keep their ids, so no data change.

-- 1. Tasks
with map(old_cat, old_sub, new_cat, new_sub) as (values
  ('remonti', 'uredi', 'it', 'uredi'),
  ('avto', 'patna-pomosht', 'prevoz', 'patna-pomosht'),
  ('pochistvane', 'gladene', 'pochistvane', 'drugo'),
  ('pochistvane', 'domashna-pomosht', 'pochistvane', 'dom'),
  ('stroitelstvo', 'do-klyuch', 'stroitelstvo', 'drugo'),
  ('gradina', 'ogradi', 'gradina', 'drugo')
)
update public.tasks t
set category = m.new_cat, subcategory = m.new_sub
from map m
where t.category = m.old_cat and t.subcategory = m.old_sub;

-- 2. Saved searches: a search belongs to one category, so subcategories that
-- moved or were removed are dropped from it. A search left with none of its
-- chosen subcategories is removed, so it does not silently widen to the whole
-- category.
do $$
declare
  a record;
  _subs text[];
  _gone constant text[] := array[
    'remonti:uredi',
    'avto:patna-pomosht',
    'pochistvane:gladene',
    'pochistvane:domashna-pomosht',
    'stroitelstvo:do-klyuch',
    'gradina:ogradi'
  ];
begin
  for a in select id, category, subcategories from public.task_alerts where subcategories is not null loop
    if not exists (
      select 1 from unnest(a.subcategories) x where a.category || ':' || x = any (_gone)
    ) then
      continue;
    end if;

    select array_agg(x order by x) into _subs
    from unnest(a.subcategories) x
    where not (a.category || ':' || x = any (_gone));

    if coalesce(cardinality(_subs), 0) = 0 then
      delete from public.task_alerts where id = a.id;
      continue;
    end if;

    begin
      update public.task_alerts set subcategories = _subs where id = a.id;
    exception when unique_violation then
      -- The same search already exists for this user: keep the older one.
      delete from public.task_alerts where id = a.id;
    end;
  end loop;
end;
$$;
