-- 1. Weighted rules
ALTER TABLE public.moderation_rules ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 1;

-- 2. Service advertisement rule set (tunable without a deploy)
DELETE FROM public.moderation_rules WHERE category = 'service_ad';

INSERT INTO public.moderation_rules (pattern, severity, category, lang, note, weight, is_active) VALUES
-- STRONG: first person offering verbs
('(^|[^а-я])предлага(м|ме)([^а-я]|$)', 'flag', 'service_ad', 'bg', 'предлагане в първо лице', 2, true),
('(^|[^а-я])извършва(м|ме)([^а-я]|$)', 'flag', 'service_ad', 'bg', 'извършвам услуги', 2, true),
('(^|[^а-я])разполагаме с', 'flag', 'service_ad', 'bg', 'разполагаме с', 2, true),
('(^|[^а-я])работим с', 'flag', 'service_ad', 'bg', 'работим с', 2, true),
('(^|[^а-я])изработва(м|ме)([^а-я]|$)', 'flag', 'service_ad', 'bg', 'изработвам', 2, true),
('(^|[^а-я])монтира(м|ме)([^а-я]|$)', 'flag', 'service_ad', 'bg', 'монтирам', 2, true),
('(^|[^а-я])доставя(м|ме)([^а-я]|$)', 'flag', 'service_ad', 'bg', 'доставям', 2, true),
('(^|[^а-я])предоставя(м|ме)([^а-я]|$)', 'flag', 'service_ad', 'bg', 'предоставям услуги', 2, true),
('(^|[^а-я])прави(м)? (ремонти|услуги|всякакви)', 'flag', 'service_ad', 'bg', 'правим услуги', 2, true),
('нашата фирма|нашият екип|нашия екип|нашата компания|фирмата ни|екипът ни|екипа ни', 'flag', 'service_ad', 'bg', 'фирмен език', 2, true),
('(^|[^А-Яа-я])(ЕООД|ООД|ЕТ|АД)([^А-Яа-я]|$)', 'flag', 'service_ad', 'bg', 'юридическо лице', 2, true),
('predlaga(m|me)|izvarshva(m|me)|izvyrshva(m|me)|montira(m|me)|dostavya(m|me)|izrabotva(m|me)|rabotim s|razpolagame s', 'flag', 'service_ad', 'bg', 'предлагане на латиница', 2, true),
-- WEAK: credentials / business signals
('дългогодишен опит|дългогодишна практика|години опит|годишен опит|опит в бранша', 'flag', 'service_ad', 'bg', 'дългогодишен опит', 1, true),
('професионале?н екип|професионални майстори|екип от професионалисти|професионално изпълнение', 'flag', 'service_ad', 'bg', 'професионален екип', 1, true),
('качествено и бързо|бързо и качествено|качествена изработка', 'flag', 'service_ad', 'bg', 'качествено и бързо', 1, true),
('гаранция за качество|гаранция на извършената|даваме гаранция|с гаранция', 'flag', 'service_ad', 'bg', 'гаранция', 1, true),
('лицензиран|сертифициран|licenziran|sertificiran', 'flag', 'service_ad', 'bg', 'лицензи и сертификати', 1, true),
('(^|[^а-я])фирма([^а-я]|$)|(^|[^a-z])firma([^a-z]|$)', 'flag', 'service_ad', 'bg', 'фирма', 1, true),
-- WEAK: sales language
('конкурентни цени|достъпни цени|ниски цени|коректни цени|най-добри цени', 'flag', 'service_ad', 'bg', 'ценова реклама', 1, true),
('безплатен оглед|безплатна консултация|безплатна оферта|безплатно предложение', 'flag', 'service_ad', 'bg', 'безплатен оглед', 1, true),
('отстъпк|промоци|promociya|otstapk', 'flag', 'service_ad', 'bg', 'отстъпки и промоции', 1, true),
('ценоразпис|ценова листа|прайс|price list', 'flag', 'service_ad', 'bg', 'ценоразпис', 1, true),
('звъннете|обадете ни се|обадете се на|свържете се с нас|потърсете ни|пишете ни', 'flag', 'service_ad', 'bg', 'призив за контакт', 1, true),
-- WEAK: availability claims
('работно време|rabotno vreme', 'flag', 'service_ad', 'bg', 'работно време', 1, true),
('24/7|24 / 7|нон стоп|нонстоп|non stop', 'flag', 'service_ad', 'bg', 'денонощно', 1, true),
('по всяко време|по всяко удобно за вас време', 'flag', 'service_ad', 'bg', 'по всяко време', 1, true),
('в цялата страна|цяла България|за цялата страна|в цялата област|na teritoriyata na', 'flag', 'service_ad', 'bg', 'покритие в страната', 1, true);

-- 3. Scoring detector
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
BEGIN
  IF _text IS NULL OR length(trim(_text)) = 0 THEN
    RETURN jsonb_build_object('verdict','clean');
  END IF;
  t := _text;
  -- "предлагам 200 лв за работата" is a budget offer, not a service advert.
  t := regexp_replace(t, '(предлага|давa|давам)(м|ме)?\s+(до\s+)?[0-9][0-9 .,]*\s*(лв|лева|евро|eur|€)?', ' ', 'gi');

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

  -- Structural signals (weak each)
  IF t ~* '(^|[^а-я])(ние|нашите|нас)([^а-я]|$)' THEN
    weak := weak + 1; score := score + 1; notes := notes || 'корпоративно множествено число';
  END IF;
  SELECT count(*) INTO prices FROM regexp_matches(t, '[0-9]+\s*(лв|лева|евро|eur|€)', 'gi');
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

-- 4. Wire into moderate_text (covers both task creation and edits)
CREATE OR REPLACE FUNCTION public.moderate_text(_text text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record; ad jsonb;
BEGIN
  IF _text IS NULL OR length(trim(_text)) = 0 THEN
    RETURN jsonb_build_object('verdict','clean');
  END IF;
  FOR r IN SELECT * FROM public.moderation_rules WHERE is_active AND category <> 'service_ad'
           ORDER BY CASE WHEN severity = 'block' THEN 0 ELSE 1 END, created_at LOOP
    BEGIN
      IF _text ~ r.pattern THEN
        RETURN jsonb_build_object('verdict', CASE WHEN r.severity = 'block' THEN 'block' ELSE 'flag' END,
          'rule_id', r.id, 'pattern', r.pattern, 'category', r.category, 'note', r.note,
          'rule_severity', r.severity, 'lang', r.lang);
      END IF;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
  END LOOP;

  ad := public.detect_service_ad(_text);
  IF ad->>'verdict' <> 'clean' THEN RETURN ad; END IF;

  RETURN jsonb_build_object('verdict','clean');
END; $function$;

-- 5. Admin counters
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _auto int; _manual int; _held int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT count(*) FILTER (WHERE status = 'approved' AND resolved_by IS NULL),
         count(*) FILTER (WHERE status <> 'pending' AND resolved_by IS NOT NULL),
         count(*) FILTER (WHERE status = 'pending' OR resolved_by IS NOT NULL)
    INTO _auto, _manual, _held
    FROM public.moderation_items WHERE created_at > now() - interval '7 days';

  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'total_tasks', (SELECT count(*) FROM public.tasks WHERE deleted_at IS NULL),
    'active_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'active' AND deleted_at IS NULL),
    'assigned_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'assigned' AND deleted_at IS NULL),
    'tasks_7d', (SELECT count(*) FROM public.tasks WHERE created_at > now() - interval '7 days'),
    'tasks_30d', (SELECT count(*) FROM public.tasks WHERE created_at > now() - interval '30 days'),
    'credits_sold', (SELECT COALESCE(sum(credits), 0) FROM public.payments WHERE status = 'completed'),
    'revenue_total', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed'),
    'revenue_7d', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed' AND completed_at > now() - interval '7 days'),
    'revenue_30d', (SELECT COALESCE(sum(amount_eur), 0) FROM public.payments WHERE status = 'completed' AND completed_at > now() - interval '30 days'),
    'unlocks_total', (SELECT count(*) FROM public.task_unlocks),
    'pending_refunds', (SELECT count(*) FROM public.credit_refund_requests WHERE status = 'pending'),
    'auto_refunds_30d', (SELECT count(*) FROM public.credit_refund_requests WHERE resolution = 'auto' AND resolved_at > now() - interval '30 days'),
    'manual_refunds_30d', (SELECT count(*) FROM public.credit_refund_requests WHERE resolution = 'manual' AND resolved_at > now() - interval '30 days'),
    'flagged_users', (SELECT count(*) FROM public.profiles p WHERE public.is_refund_flagged(p.id)),
    'pending_reports', (SELECT count(*) FROM public.task_reports WHERE status = 'pending'),
    'moderation_pending', (SELECT count(*) FROM public.moderation_items WHERE status = 'pending'),
    'moderation_oldest', (SELECT min(created_at) FROM public.moderation_items WHERE status = 'pending'),
    'moderation_auto_7d', _auto,
    'moderation_manual_7d', _manual,
    'moderation_auto_rate_7d', CASE WHEN (_auto + _held) > 0
      THEN round((_auto::numeric * 100) / (_auto + _held), 1) ELSE NULL END,
    'service_ad_blocks_30d', (SELECT count(*) FROM public.content_violations
       WHERE violation_type = 'service_ad' AND created_at > now() - interval '30 days'),
    'service_ad_blocks_7d', (SELECT count(*) FROM public.content_violations
       WHERE violation_type = 'service_ad' AND created_at > now() - interval '7 days'),
    'service_ad_flags_30d', (SELECT count(*) FROM public.moderation_items
       WHERE category = 'service_ad' AND created_at > now() - interval '30 days'),
    'tasks_pending', (SELECT count(*) FROM public.tasks WHERE status = 'pending' AND deleted_at IS NULL),
    'tasks_pending_oldest', (SELECT min(created_at) FROM public.tasks WHERE status = 'pending' AND deleted_at IS NULL),
    'contact_new', (SELECT count(*) FROM public.contact_messages WHERE status = 'new'),
    'violations_30d', (SELECT count(*) FROM public.content_violations WHERE created_at > now() - interval '30 days'),
    'credit_mismatches', (SELECT count(*) FROM public.profiles p
       WHERE p.credits <> COALESCE((SELECT sum(t.amount)::int FROM public.credit_transactions t WHERE t.user_id = p.id), 0)),
    'rule_engine_errors_7d', (SELECT count(*) FROM public.cron_runs
       WHERE job_name = 'refund_rule_engine' AND error IS NOT NULL AND started_at > now() - interval '7 days')
  );
END; $function$;