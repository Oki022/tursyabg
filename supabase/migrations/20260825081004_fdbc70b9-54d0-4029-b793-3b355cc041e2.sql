DROP TRIGGER IF EXISTS messages_notify_trg ON public.messages;
DROP FUNCTION IF EXISTS public.notify_new_message();
DELETE FROM public.notifications WHERE type = 'new_message';