-- Categories v3: "grizha" (care) is removed and "stroitelstvo" (construction)
-- is added (src/lib/subcategories.ts). Roofs and rough construction move from
-- "remonti" to "stroitelstvo"; ironing and housekeeping move to "pochistvane".
-- Child and elderly care is no longer offered: those tasks become
-- "pochistvane / drugo".

-- 1. Tasks
update public.tasks set category = 'stroitelstvo'
where category = 'remonti' and subcategory in ('grub-stroezh', 'pokrivi');

update public.tasks set category = 'pochistvane'
where category = 'grizha' and subcategory in ('gladene', 'domashna-pomosht');

update public.tasks set category = 'pochistvane', subcategory = 'drugo'
where category = 'grizha';

-- 2. Saved searches
-- Care searches no longer match anything.
delete from public.task_alerts where category = 'grizha';

-- Repair searches lose the subcategories that moved to construction. A search
-- left with none of its chosen subcategories is removed, so it does not
-- silently widen to the whole category.
do $$
declare
  a record;
  _subs text[];
begin
  for a in
    select id, subcategories from public.task_alerts
    where category = 'remonti'
      and subcategories && array['grub-stroezh', 'pokrivi']::text[]
  loop
    select array_agg(x order by x) into _subs
    from unnest(a.subcategories) x
    where x not in ('grub-stroezh', 'pokrivi');

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
