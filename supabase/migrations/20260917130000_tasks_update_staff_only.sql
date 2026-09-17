alter policy tasks_update on public.tasks
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));