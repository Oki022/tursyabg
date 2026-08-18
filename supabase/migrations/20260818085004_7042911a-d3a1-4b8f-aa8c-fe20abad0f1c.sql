REVOKE EXECUTE ON FUNCTION public.update_own_task(uuid, text, text, text, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_own_task(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.own_task_delete_preview(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_contact_status(uuid, text, text) FROM anon;