
-- 1. Gibberish detector -------------------------------------------------
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

  -- more than 3 identical characters in a row
  IF s ~ '(.)\1{3,}' THEN RETURN true; END IF;

  -- common keyboard-mash sequences
  IF s ~ '(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm|qazwsx|qwerty|йцук|цуке|укен|фыва|ячсм|абвгд)' THEN
    RETURN true;
  END IF;

  -- vowels present and in a plausible ratio
  v := n - length(regexp_replace(letters, '[аъоуеияюaeiouy]', '', 'g'));
  IF v = 0 THEN RETURN true; END IF;
  IF n >= 6 THEN
    ratio := v::numeric / n;
    IF ratio < 0.15 OR ratio > 0.85 THEN RETURN true; END IF;
  END IF;

  -- no run of 5+ consonants without a vowel
  devoweled := regexp_replace(regexp_replace(s, '[аъоуеияюaeiouy]', ' ', 'g'), '[^[:alpha:]]', ' ', 'g');
  IF devoweled ~ '[[:alpha:]]{5,}' THEN RETURN true; END IF;

  -- a single character dominating the text
  IF n >= 8 THEN
    SELECT max(cnt) INTO maxc FROM (
      SELECT count(*) AS cnt FROM regexp_split_to_table(letters, '') g GROUP BY g
    ) x;
    IF maxc::numeric / n > 0.4 THEN RETURN true; END IF;
  END IF;

  RETURN false;
END;
$$;

-- 2. Reusable text quality check ----------------------------------------
CREATE OR REPLACE FUNCTION public.text_quality_issue(_text text, _min_len int, _max_len int, _min_words int)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE s text; words text[]; distinct_words int; total_words int;
BEGIN
  s := btrim(coalesce(_text, ''));
  IF length(s) < _min_len THEN RETURN 'TOO_SHORT'; END IF;
  IF length(s) > _max_len THEN RETURN 'TOO_LONG'; END IF;
  IF regexp_replace(s, '[^[:alpha:]]', '', 'g') = '' THEN RETURN 'NO_LETTERS'; END IF;

  SELECT array_agg(w) INTO words
  FROM (
    SELECT DISTINCT lower(w) AS w
    FROM regexp_split_to_table(s, '[^[:alnum:]]+') w
    WHERE length(w) >= 2
  ) x;
  distinct_words := coalesce(array_length(words, 1), 0);
  SELECT count(*) INTO total_words
  FROM regexp_split_to_table(s, '[^[:alnum:]]+') w WHERE length(w) >= 2;

  IF distinct_words = 1 AND total_words > 1 THEN RETURN 'REPEATED_WORD'; END IF;
  IF distinct_words < _min_words THEN RETURN 'TOO_FEW_WORDS'; END IF;
  IF public.is_gibberish(s) THEN RETURN 'GIBBERISH'; END IF;
  RETURN NULL;
END;
$$;

-- 3. Task content validation --------------------------------------------
CREATE OR REPLACE FUNCTION public.task_content_issue(_title text, _description text, _budget numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE issue text;
BEGIN
  issue := public.text_quality_issue(_title, 10, 100, 2);
  IF issue IS NOT NULL THEN RETURN 'TITLE_' || issue; END IF;

  issue := public.text_quality_issue(_description, 30, 2000, 5);
  IF issue IS NOT NULL THEN RETURN 'DESCRIPTION_' || issue; END IF;

  IF lower(btrim(coalesce(_description, ''))) = lower(btrim(coalesce(_title, ''))) THEN
    RETURN 'DESCRIPTION_SAME_AS_TITLE';
  END IF;

  IF _budget IS NULL OR _budget <= 0 THEN RETURN 'BUDGET_INVALID'; END IF;
  IF _budget < 5 THEN RETURN 'BUDGET_TOO_LOW'; END IF;
  IF _budget > 500000 THEN RETURN 'BUDGET_TOO_HIGH'; END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tasks_validate_quality()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE issue text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.budget IS NOT DISTINCT FROM OLD.budget THEN
    RETURN NEW;
  END IF;
  issue := public.task_content_issue(NEW.title, NEW.description, NEW.budget);
  IF issue IS NOT NULL THEN
    RAISE EXCEPTION 'CONTENT_QUALITY:%', issue;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_validate_quality_trg ON public.tasks;
CREATE TRIGGER tasks_validate_quality_trg
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_validate_quality();

-- 4. Review comments -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.reviews_validate_quality()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE issue text;
BEGIN
  IF NEW.comment IS NULL OR btrim(NEW.comment) = '' THEN RETURN NEW; END IF;
  issue := public.text_quality_issue(NEW.comment, 10, 2000, 2);
  IF issue IS NOT NULL THEN
    RAISE EXCEPTION 'CONTENT_QUALITY:COMMENT_%', issue;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_validate_quality_trg ON public.reviews;
CREATE TRIGGER reviews_validate_quality_trg
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.reviews_validate_quality();

-- 5. Flag existing low-quality tasks into the moderation queue ------------
CREATE OR REPLACE FUNCTION public.flag_low_quality_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r record; issue text; flagged int := 0;
BEGIN
  FOR r IN SELECT id, user_id, title, description, budget FROM public.tasks WHERE deleted_at IS NULL LOOP
    issue := public.task_content_issue(r.title, r.description, r.budget);
    IF issue IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.moderation_items m
      WHERE m.task_id = r.id AND m.category = 'quality' AND m.status = 'pending'
    ) THEN
      PERFORM public.enqueue_moderation('text', 'task', r.id, r.id, r.user_id, 'low',
        'Съдържанието не покрива изискванията за качество (' || issue || ')',
        'quality', issue, left(r.title || ' — ' || coalesce(r.description, ''), 400),
        jsonb_build_object('issue', issue));
      flagged := flagged + 1;
    END IF;
  END LOOP;
  RETURN flagged;
END;
$$;

REVOKE ALL ON FUNCTION public.flag_low_quality_tasks() FROM PUBLIC, anon, authenticated;

SELECT public.flag_low_quality_tasks();
