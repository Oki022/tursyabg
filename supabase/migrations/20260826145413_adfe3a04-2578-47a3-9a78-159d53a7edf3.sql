CREATE OR REPLACE FUNCTION public.tasks_resolve_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE m record;
BEGIN
  IF NEW.city IS NULL THEN
    NEW.municipality_id := NULL;
    NEW.region_id := NULL;
    RETURN NEW;
  END IF;

  -- Deterministic resolution: prefer a municipality inside the region already
  -- set on the task, otherwise fall back to the lowest slug so duplicate
  -- names (Бяла / Варна and Бяла / Русе) never resolve arbitrarily.
  SELECT mu.id, mu.region_id INTO m
  FROM public.municipalities mu
  WHERE mu.name = NEW.city
  ORDER BY (NEW.region_id IS NOT NULL AND mu.region_id = NEW.region_id) DESC, mu.slug ASC
  LIMIT 1;

  IF m.id IS NOT NULL THEN
    NEW.municipality_id := m.id;
    NEW.region_id := m.region_id;
  END IF;
  RETURN NEW;
END;
$$;