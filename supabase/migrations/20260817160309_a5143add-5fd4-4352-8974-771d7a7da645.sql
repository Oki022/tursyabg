
REVOKE EXECUTE ON FUNCTION public.push_notification(uuid, public.notification_type, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sweep_expiry_notifications() FROM PUBLIC, anon, authenticated;
