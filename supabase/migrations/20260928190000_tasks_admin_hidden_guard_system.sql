create or replace function public.tasks_admin_hidden_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  -- Само за заявки от потребители. Системните процеси (service role, cron) нямат
  -- потребителска роля в JWT и не се проверяват, иначе is_staff() им отказва достъп.
  if coalesce(auth.jwt() ->> 'role', 'system') in ('authenticated', 'anon')
     and not coalesce(public.is_staff(auth.uid()), false) then
    new.admin_hidden_at := old.admin_hidden_at;
    if old.admin_hidden_at is not null then
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;