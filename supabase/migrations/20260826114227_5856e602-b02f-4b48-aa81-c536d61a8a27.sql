CREATE OR REPLACE FUNCTION public.block_deactivated_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid;
BEGIN
  _uid := CASE TG_TABLE_NAME
    WHEN 'messages' THEN (to_jsonb(NEW)->>'sender_id')::uuid
    ELSE (to_jsonb(NEW)->>'user_id')::uuid
  END;

  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.deactivated_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ACCOUNT_DEACTIVATED';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS task_unlocks_block_deactivated ON public.task_unlocks;
CREATE TRIGGER task_unlocks_block_deactivated
  BEFORE INSERT ON public.task_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.block_deactivated_author();

REVOKE ALL ON FUNCTION public.block_deactivated_author() FROM PUBLIC, anon, authenticated;