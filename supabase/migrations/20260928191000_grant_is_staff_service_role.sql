-- service_role вече има пълен достъп до базата; тази проверка само чете ролите.
-- Нужно е, защото тригерът zz_tasks_admin_hidden_guard съдържа is_staff() и
-- Postgres проверява правото за изпълнение, дори когато условието я прескача.
grant execute on function public.is_staff(uuid) to service_role;
grant execute on function public.has_role(uuid, public.app_role) to service_role;