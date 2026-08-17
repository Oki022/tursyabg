
CREATE OR REPLACE FUNCTION public.mask_contacts(input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE out text := input;
BEGIN
  IF out IS NULL THEN RETURN NULL; END IF;

  out := regexp_replace(out, '[[:alnum:]._%+-]+\s*(@|\(at\)|\[at\]|\s+at\s+|\s+собачка\s+)\s*[[:alnum:].-]+\.[a-zA-Z]{2,}', '•••', 'gi');

  out := regexp_replace(out, '(viber|whats\s?app|telegram|messenger|skype|signal|instagram|вайбър|вибер|уатсап|ватсап|телеграм|скайп|инстаграм)([[:space:][:punct:]]{0,6})([@[:alnum:]._-]{3,})', '\1\2•••', 'gi');

  out := regexp_replace(out, '(^|[[:space:]])@[[:alnum:]._-]{3,}', '\1•••', 'g');

  out := regexp_replace(out, '((нула|нол|едно|един|две|три|четири|пет|шест|седем|осем|девет)[[:space:],.–-]+){5,}(нула|нол|едно|един|две|три|четири|пет|шест|седем|осем|девет)', '•••', 'gi');

  out := regexp_replace(
    out,
    '(?=(?:[0-9OoОоІіlіЗзбБВв][[:space:]()-]*){8})(?=(?:[^0-9]{0,3}[0-9]){4})[0-9OoОоІіlіЗзбБВв]([[:space:]()-]*[0-9OoОоІіlіЗзбБВв]){7,}',
    '•••', 'g');

  out := regexp_replace(out, '(\+|00)?[[:space:]]*3[[:space:].-]*5[[:space:].-]*9([[:space:].()/-]*[0-9]){8,9}', '•••', 'g');
  out := regexp_replace(out, '0([[:space:].()/-]*[0-9]){8,}', '•••', 'g');
  out := regexp_replace(out, '([0-9][[:space:].()/-]*){9,}', '•••', 'g');

  out := regexp_replace(out, '[+(]\s*•••', '•••', 'g');

  RETURN out;
END;
$function$;
