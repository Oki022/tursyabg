-- GDPR data export: include the "По договаряне" range next to the budget, so
-- a user's export shows exactly what they entered.
do $$
declare
  def text := pg_get_functiondef('public.export_my_data'::regproc);
  newdef text;
begin
  if def like '%budget_range%' then
    return; -- already updated
  end if;
  newdef := replace(def, 'budget, currency,', 'budget, budget_range, currency,');
  if newdef = def then
    raise exception 'export_my_data: expected "budget, currency," not found';
  end if;
  execute newdef;
end $$;

notify pgrst, 'reload schema';
