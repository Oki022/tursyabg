
CREATE OR REPLACE FUNCTION public.is_gibberish(_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  s text; letters text; devoweled text; n int; v int; ratio numeric; maxc int;
BEGIN
  s := lower(coalesce(_text, ''));
  letters := regexp_replace(s, '[^[:alpha:]]', '', 'g');
  n := length(letters);
  IF n = 0 THEN RETURN true; END IF;

  IF s ~ '(.)\1{3,}' THEN RETURN true; END IF;

  IF s ~ '(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm|qazwsx|qwerty|йцук|цуке|укен|фыва|ячсм|абвгд|фдса|дсаф|ждло|ялдж|ъвер|ьбню|ючсм)' THEN
    RETURN true;
  END IF;

  v := n - length(regexp_replace(letters, '[аъоуеияюaeiouy]', '', 'g'));
  IF v = 0 THEN RETURN true; END IF;
  IF n >= 6 THEN
    ratio := v::numeric / n;
    IF ratio < 0.15 OR ratio > 0.85 THEN RETURN true; END IF;
  END IF;

  devoweled := regexp_replace(regexp_replace(s, '[аъоуеияюaeiouy]', ' ', 'g'), '[^[:alpha:]]', ' ', 'g');
  IF devoweled ~ '[[:alpha:]]{5,}' THEN RETURN true; END IF;

  IF n >= 8 THEN
    SELECT max(cnt) INTO maxc FROM (
      SELECT count(*) AS cnt FROM regexp_split_to_table(letters, '') g GROUP BY g
    ) x;
    IF maxc::numeric / n > 0.4 THEN RETURN true; END IF;
  END IF;

  RETURN false;
END;
$$;

SELECT public.flag_low_quality_tasks();
