REVOKE EXECUTE ON FUNCTION public.find_or_create_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_conversation(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_own_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_task(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_correct_task_category(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_correct_task_category(uuid, text) TO authenticated;