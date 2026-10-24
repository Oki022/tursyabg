-- The push sender (/api/public/push/send) reads and cleans public.push_devices
-- with the service role, but new tables in this project do not get default
-- grants for service_role, so it saw no phones ("sent": 0).
grant select, insert, update, delete on public.push_devices to service_role;
