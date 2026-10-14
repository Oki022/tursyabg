-- The unconfirmed-account reminder job still called the old Lovable preview
-- URL. Point it at the production site, like the new task-alert job.
do $$
declare
  def text := pg_get_functiondef('public.call_unconfirmed_reminders'::regproc);
  newdef text;
begin
  newdef := regexp_replace(def, 'https://[^/'']+\.lovable\.app', 'https://tursya.bg');
  if newdef <> def then
    execute newdef;
  end if;
end $$;
