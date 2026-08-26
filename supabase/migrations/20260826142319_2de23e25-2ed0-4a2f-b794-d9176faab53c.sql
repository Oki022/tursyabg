CREATE OR REPLACE FUNCTION public.is_gibberish(_text text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE s text; raw text; letters text; devoweled text; n int; v int; ratio numeric; maxc int;
BEGIN
  raw := btrim(regexp_replace(lower(coalesce(_text, '')), '\s+', ' ', 'g'));

  -- Latin brand/product tokens (IKEA, JYSK, Bosch, iPhone, SKU codes) carry no
  -- signal for a Bulgarian gibberish heuristic and used to trip the
  -- consonant-cluster rules. Drop them before analysing, unless the text is
  -- Latin-only (then analyse it as-is). Whitespace is collapsed again so the
  -- gaps left behind never look like a repeated-character run.
  s := raw;
  IF raw ~ '[а-яё]' THEN
    s := btrim(regexp_replace(regexp_replace(raw, '[a-z][a-z0-9''-]{0,15}', ' ', 'g'), '\s+', ' ', 'g'));
    IF regexp_replace(s, '[^[:alpha:]]', '', 'g') = '' THEN
      s := raw;
    END IF;
  END IF;

  letters := regexp_replace(s, '[^[:alpha:]]', '', 'g');
  n := length(letters);
  IF n = 0 THEN RETURN true; END IF;

  IF s ~ '([[:alnum:]])\1{3,}' THEN RETURN true; END IF;

  IF s ~ '(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm|qazwsx|qwerty|йцук|цуке|укен|фыва|ячсм|абвгд|фдса|дсаф|ждло|ялдж|ъвер|ьбню|ючсм)' THEN
    RETURN true;
  END IF;

  v := n - length(regexp_replace(letters, '[аъоуеияюaeiouy]', '', 'g'));
  IF v = 0 AND n >= 5 THEN RETURN true; END IF;
  IF n >= 8 THEN
    ratio := v::numeric / n;
    IF ratio < 0.12 OR ratio > 0.88 THEN RETURN true; END IF;
  END IF;

  devoweled := regexp_replace(regexp_replace(s, '[аъоуеияюaeiouy]', ' ', 'g'), '[^[:alpha:]]', ' ', 'g');
  IF devoweled ~ '[[:alpha:]]{6,}' THEN RETURN true; END IF;

  IF n >= 10 THEN
    SELECT max(cnt) INTO maxc FROM (
      SELECT count(*) AS cnt FROM regexp_split_to_table(letters, '') g GROUP BY g
    ) x;
    IF maxc::numeric / n > 0.45 THEN RETURN true; END IF;
  END IF;

  RETURN false;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_gibberish(text) FROM anon, authenticated;