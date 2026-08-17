
CREATE OR REPLACE FUNCTION public.mask_contacts(input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE out text := input;
BEGIN
  IF out IS NULL THEN RETURN NULL; END IF;

  -- emails (incl. "at" obfuscation)
  out := regexp_replace(out, '[[:alnum:]._%+-]+\s*(@|\(at\)|\[at\]|\s+at\s+|\s+собачка\s+)\s*[[:alnum:].-]+\.[a-zA-Z]{2,}', '•••', 'gi');

  -- messenger handles after a platform keyword
  out := regexp_replace(out, '(viber|whats\s?app|telegram|messenger|skype|signal|instagram|вайбър|вибер|уатсап|ватсап|телеграм|скайп|инстаграм)([[:space:][:punct:]]{0,6})([@[:alnum:]._-]{3,})', '\1\2•••', 'gi');

  -- standalone @handles
  out := regexp_replace(out, '(^|[[:space:]])@[[:alnum:]._-]{3,}', '\1•••', 'g');

  -- written-out digits in Bulgarian (6+ in a row)
  out := regexp_replace(out, '((нула|нол|едно|един|две|три|четири|пет|шест|седем|осем|девет)[[:space:],.–-]+){5,}(нула|нол|едно|един|две|три|четири|пет|шест|седем|осем|девет)', '•••', 'gi');

  -- +359 / 00359 prefixed numbers
  out := regexp_replace(out, '(\+|00)?[[:space:]]*3[[:space:].-]*5[[:space:].-]*9([[:space:].()/-]*[0-9]){8,9}', '•••', 'g');
  -- 0-prefixed national numbers
  out := regexp_replace(out, '0([[:space:].()/-]*[0-9]){8,}', '•••', 'g');
  -- any long digit run
  out := regexp_replace(out, '([0-9][[:space:].()/-]*){9,}', '•••', 'g');

  -- Cyrillic/latin lookalike obfuscation: 8+ digit-like chars containing at least 4 real digits
  out := regexp_replace(
    out,
    '(?=(?:[0-9OoОоІіlі][[:space:].()/-]*){8})(?=(?:[^0-9]{0,3}[0-9]){4})[0-9OoОоІіlі]([[:space:].()/-]*[0-9OoОоІіlі]){7,}',
    '•••', 'g');

  RETURN out;
END;
$function$;

DROP TRIGGER IF EXISTS messages_mask_contacts_trg ON public.messages;
CREATE TRIGGER messages_mask_contacts_trg
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_mask_contacts();

CREATE OR REPLACE FUNCTION public.is_valid_bg_phone(_phone text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT _phone IS NOT NULL
     AND regexp_replace(_phone, '[^0-9+]', '', 'g') ~ '^(\+3598[7-9][0-9]{7}|003598[7-9][0-9]{7}|3598[7-9][0-9]{7}|08[7-9][0-9]{7})$'
$function$;

ALTER TABLE public.profile_contacts DROP CONSTRAINT IF EXISTS profile_contacts_phone_valid;
ALTER TABLE public.profile_contacts
  ADD CONSTRAINT profile_contacts_phone_valid
  CHECK (phone IS NULL OR public.is_valid_bg_phone(phone)) NOT VALID;

CREATE OR REPLACE FUNCTION public.require_owner_phone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profile_contacts c
    WHERE c.user_id = auth.uid() AND public.is_valid_bg_phone(c.phone)
  ) THEN
    RAISE EXCEPTION 'PHONE_REQUIRED';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tasks_require_phone_trg ON public.tasks;
CREATE TRIGGER tasks_require_phone_trg
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.require_owner_phone();

DROP TRIGGER IF EXISTS messages_require_phone_trg ON public.messages;
CREATE TRIGGER messages_require_phone_trg
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.require_owner_phone();
