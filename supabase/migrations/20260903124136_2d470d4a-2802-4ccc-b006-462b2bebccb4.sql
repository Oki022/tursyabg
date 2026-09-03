CREATE OR REPLACE FUNCTION public.detect_service_ad(_text text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record; t text; strong int := 0; weak int := 0; score int := 0;
  matched jsonb := '[]'::jsonb; top jsonb := NULL; notes text[] := '{}';
  prices int; has_need boolean;
  -- Euro first, leva kept as a legacy fallback. Handles "200 €", "200€",
  -- "€200", "200 евро", "200 eur/EUR", "200,50 €", "200.50 €".
  money_re constant text :=
    '((€|eur|евро)\s*[0-9]+([.,][0-9]{1,2})?|[0-9]+([.,][0-9]{1,2})?\s*(€|eur|евро|лв\.?|лева))';
BEGIN
  IF _text IS NULL OR length(trim(_text)) = 0 THEN
    RETURN jsonb_build_object('verdict','clean');
  END IF;
  t := _text;
  -- "предлагам 200 € за работата" is a budget offer, not a service advert.
  t := regexp_replace(
        t,
        '(предлага|дава|давам)(м|ме)?\s+(до\s+)?' || money_re,
        ' ', 'gi');
  -- Also strip a bare amount offer without a currency ("предлагам 200 за това").
  t := regexp_replace(t, '(предлага|дава|давам)(м|ме)?\s+(до\s+)?[0-9][0-9 .,]*', ' ', 'gi');

  FOR r IN SELECT * FROM public.moderation_rules
           WHERE is_active AND category = 'service_ad' ORDER BY weight DESC, created_at LOOP
    BEGIN
      IF t ~* r.pattern THEN
        IF r.weight >= 2 THEN strong := strong + 1; ELSE weak := weak + 1; END IF;
        score := score + GREATEST(r.weight, 1);
        matched := matched || jsonb_build_object('rule_id', r.id, 'pattern', r.pattern,
          'note', r.note, 'weight', r.weight);
        notes := notes || COALESCE(NULLIF(r.note, ''), r.pattern);
        IF top IS NULL THEN
          top := jsonb_build_object('rule_id', r.id, 'pattern', r.pattern, 'note', r.note);
        END IF;
      END IF;
    EXCEPTION WHEN others THEN CONTINUE; END;
  END LOOP;

  IF t ~* '(^|[^а-я])(ние|нашите|нас)([^а-я]|$)' THEN
    weak := weak + 1; score := score + 1; notes := notes || 'корпоративно множествено число';
  END IF;
  SELECT count(*) INTO prices FROM regexp_matches(t, money_re, 'gi');
  IF prices >= 3 THEN
    weak := weak + 1; score := score + 1; notes := notes || 'списък с цени вместо един бюджет';
  END IF;
  has_need := t ~* 'търся|трябва|нужд|нуждая|имам проблем|искам да|може ли|помощ|да се направи|да ми';
  IF NOT has_need AND length(t) > 120 AND (strong + weak) > 0 THEN
    weak := weak + 1; score := score + 1; notes := notes || 'липсва описана нужда';
  END IF;

  IF score = 0 THEN RETURN jsonb_build_object('verdict','clean'); END IF;

  RETURN jsonb_build_object(
    'verdict', CASE WHEN strong >= 2 OR score >= 3 THEN 'block' ELSE 'flag' END,
    'category', 'service_ad',
    'score', score, 'strong', strong, 'weak', weak,
    'matched', matched,
    'rule_id', top->>'rule_id',
    'pattern', COALESCE(top->>'pattern', ''),
    'rule_severity', 'flag',
    'lang', 'bg',
    'note', 'Обява за услуга: ' || array_to_string(notes, ', '));
END; $function$;

REVOKE ALL ON FUNCTION public.detect_service_ad(text) FROM PUBLIC, anon, authenticated;