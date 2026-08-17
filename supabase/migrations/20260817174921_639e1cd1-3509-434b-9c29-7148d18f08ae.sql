-- ENUM additions
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'content_rejected';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'content_held';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'content_approved';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'moderation_warning';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'account_suspended';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'account_banned';

-- PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trust_level integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_until timestamptz;

-- TASK IMAGES moderation verdict
ALTER TABLE public.task_images ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.task_images ADD COLUMN IF NOT EXISTS moderation_score numeric;
ALTER TABLE public.task_images ADD COLUMN IF NOT EXISTS moderation_labels jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.task_images ADD COLUMN IF NOT EXISTS moderation_provider text;

-- MODERATION RULES
CREATE TABLE IF NOT EXISTS public.moderation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('block','flag')),
  category text NOT NULL,
  lang text NOT NULL DEFAULT 'bg',
  note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.moderation_rules TO authenticated;
GRANT ALL ON public.moderation_rules TO service_role;
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read rules" ON public.moderation_rules FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER moderation_rules_updated_at BEFORE UPDATE ON public.moderation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CONTENT VIOLATIONS
CREATE TABLE IF NOT EXISTS public.content_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id uuid,
  violation_type text NOT NULL,
  severity text NOT NULL DEFAULT 'block',
  auto_detected boolean NOT NULL DEFAULT true,
  action_taken text NOT NULL DEFAULT 'warning',
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_violations TO authenticated;
GRANT ALL ON public.content_violations TO service_role;
ALTER TABLE public.content_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own violations" ON public.content_violations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "staff violations" ON public.content_violations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- MODERATION QUEUE
CREATE TABLE IF NOT EXISTS public.moderation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('image','text','report')),
  content_type text NOT NULL,
  content_id uuid,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('high','medium','low')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  matched_pattern text,
  excerpt text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_items_status_idx ON public.moderation_items (status, severity, created_at);
GRANT SELECT ON public.moderation_items TO authenticated;
GRANT ALL ON public.moderation_items TO service_role;
ALTER TABLE public.moderation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff queue" ON public.moderation_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "own queue items" ON public.moderation_items FOR SELECT TO authenticated USING (user_id = auth.uid());

-- SEED RULES
INSERT INTO public.moderation_rules (pattern, severity, category, lang, note) VALUES
  ('(?i)(биткойн|битколн|bitcoin|btc|крипто|crypto|kripto|форекс|forex|бинарни опции)[^.]{0,40}(инвест|печал|доход|profit|invest|zarab|заработ)', 'block', 'scam', 'mixed', 'Крипто/инвестиционни схеми'),
  ('(?i)(изпрати|прати|преведи|прехвърли|send|prati|izprati)[^.]{0,30}(пари|сума|депозит|капаро|money|deposit|kaparo|pari)[^.]{0,30}(предварително|първо|напред|first|advance|predvaritelno)', 'block', 'scam', 'mixed', 'Плащане предварително'),
  ('(?i)(western\s*union|money\s*gram|moneygram|payoneer\s*код|gift\s*card|подаръчна\s*карта|paysafe)', 'flag', 'scam', 'mixed', 'Нетипични методи на плащане'),
  ('(?i)(лесни|бързи|garantirani|гарантирани)\s*(пари|доходи|печалби)|(zarabotka|заработка)\s*от\s*вкъщи', 'flag', 'scam', 'mixed', 'Схеми за бързи пари'),
  ('(?i)(наследство|inheritance|лотария|lottery|спечелихте|печелите\s*награда)', 'flag', 'scam', 'mixed', 'Класически измами'),
  ('(?i)(интимн[аи]|еротичн|секс\s*услуг|sex\s*service|escort|ескорт|проститу|prostitu|голи\s*снимки|nudes)', 'block', 'sexual', 'mixed', 'Сексуални услуги'),
  ('(?i)(seks|sex)\s*(sreshtu|срещу)\s*(pari|пари)', 'block', 'sexual', 'mixed', 'Секс срещу пари'),
  ('(?i)(ще\s*те\s*(убия|пребия|намеря)|ubiya|prebiya|ще\s*съжаляваш|kill\s*you|threat\s*to\s*kill)', 'block', 'threat', 'mixed', 'Заплахи'),
  ('(?i)(цигани|мангали|mangali|цигань|негър|negur|nigger|педал|pedal|обратен\s*гей|жид)', 'block', 'hate', 'mixed', 'Реч на омразата'),
  ('(?i)(смърт\s*на\s*(всички|тия)|да\s*изгорят|газова\s*камера)', 'block', 'hate', 'mixed', 'Призиви за насилие'),
  ('(?i)(оръжие\s*за\s*продан|пистолет\s*без\s*документи|наркотик|дрога|weed|марихуана|метамфетамин|kokain|кокаин)', 'flag', 'illegal', 'mixed', 'Незаконни стоки'),
  ('(?i)(фалшив[аи]?\s*(документ|диплома|лична\s*карта)|falshiv[ai]?\s*dokument)', 'block', 'illegal', 'mixed', 'Фалшиви документи'),
  ('(?i)(кликни\s*тук|click\s*here)[^.]{0,20}(http|www\.|\.ru|\.top|\.xyz)', 'flag', 'spam', 'mixed', 'Съмнителни линкове'),
  ('(?i)(реферален\s*код|referral\s*link|мрежов\s*маркетинг|mlm|пирамида)', 'flag', 'spam', 'mixed', 'MLM/спам')
ON CONFLICT DO NOTHING;

-- TEXT MODERATION
CREATE OR REPLACE FUNCTION public.moderate_text(_text text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  IF _text IS NULL OR length(trim(_text)) = 0 THEN
    RETURN jsonb_build_object('verdict','clean');
  END IF;
  FOR r IN SELECT * FROM public.moderation_rules WHERE is_active
           ORDER BY CASE WHEN severity = 'block' THEN 0 ELSE 1 END, created_at LOOP
    BEGIN
      IF _text ~ r.pattern THEN
        RETURN jsonb_build_object('verdict', CASE WHEN r.severity = 'block' THEN 'block' ELSE 'flag' END,
          'rule_id', r.id, 'pattern', r.pattern, 'category', r.category, 'note', r.note);
      END IF;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
  END LOOP;
  RETURN jsonb_build_object('verdict','clean');
END; $$;

-- TRUST
CREATE OR REPLACE FUNCTION public.user_trust(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'trust_level', p.trust_level,
    'account_age_days', GREATEST(EXTRACT(day FROM now() - p.created_at)::int, 0),
    'confirmed_engagements', (SELECT count(*) FROM public.engagements e
       WHERE e.professional_id = p.id AND e.status = 'confirmed'),
    'violations', (SELECT count(*) FROM public.content_violations v
       WHERE v.user_id = p.id AND v.reverted_at IS NULL),
    'suspended_until', p.suspended_until,
    'banned', p.banned_at IS NOT NULL
  ) FROM public.profiles p WHERE p.id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.needs_prepublish_review(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t jsonb;
BEGIN
  t := public.user_trust(_user_id);
  IF t IS NULL THEN RETURN true; END IF;
  IF (t->>'trust_level')::int >= 1 AND (t->>'violations')::int = 0 THEN RETURN false; END IF;
  IF (t->>'violations')::int > 0 THEN RETURN true; END IF;
  RETURN (t->>'account_age_days')::int < 7 OR (t->>'confirmed_engagements')::int = 0;
END; $$;

-- BAN CASCADE
CREATE OR REPLACE FUNCTION public.ban_user_cascade(_user_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _row record; _balance int; _refunded int := 0; _credits int := 0;
BEGIN
  UPDATE public.profiles SET banned_at = now(), ban_reason = _reason WHERE id = _user_id;

  FOR _row IN
    SELECT u.user_id, u.credits_spent FROM public.task_unlocks u
    JOIN public.tasks t ON t.id = u.task_id
    WHERE t.user_id = _user_id AND u.unlocked_at > now() - interval '30 days'
  LOOP
    UPDATE public.profiles SET credits = credits + _row.credits_spent
      WHERE id = _row.user_id RETURNING credits INTO _balance;
    INSERT INTO public.credit_transactions (user_id, amount, type, balance_after, description)
    VALUES (_row.user_id, _row.credits_spent, 'refund', _balance,
      'Автоматично възстановяване — профилът на подателя беше блокиран');
    PERFORM public.push_notification(_row.user_id, 'refund_auto_approved',
      'Кредитите ти са върнати', 'Профилът на подателя беше блокиран. Върнати са ти '
        || _row.credits_spent || ' кредита.', '/settings/billing', NULL);
    _refunded := _refunded + 1;
    _credits := _credits + _row.credits_spent;
  END LOOP;

  UPDATE public.tasks SET status = 'inactive' WHERE user_id = _user_id AND status <> 'inactive';

  PERFORM public.push_notification(_user_id, 'account_banned', 'Профилът ти е блокиран',
    COALESCE(_reason, 'Нарушение на правилата за съдържание.') || ' Ако смяташ, че има грешка, свържи се с екипа.',
    '/terms', NULL);

  RETURN jsonb_build_object('ok', true, 'refunded_users', _refunded, 'refunded_credits', _credits);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_ban(_user_id uuid, _banned boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _res jsonb;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF _banned AND (_reason IS NULL OR length(trim(_reason)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;
  IF _user_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;

  IF _banned THEN
    _res := public.ban_user_cascade(_user_id, _reason);
  ELSE
    UPDATE public.profiles SET banned_at = NULL, ban_reason = NULL, suspended_until = NULL WHERE id = _user_id;
    UPDATE public.content_violations SET reverted_at = now() WHERE user_id = _user_id AND reverted_at IS NULL;
    _res := jsonb_build_object('ok', true);
  END IF;

  PERFORM public.log_admin_action(CASE WHEN _banned THEN 'user_banned' ELSE 'user_unbanned' END,
    'profile', _user_id, jsonb_build_object('reason', COALESCE(_reason, ''), 'cascade', _res));
  RETURN _res;
END; $$;

-- PROGRESSIVE ENFORCEMENT
CREATE OR REPLACE FUNCTION public.record_content_violation(_user_id uuid, _content_type text, _content_id uuid,
  _violation_type text, _severity text, _auto boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _n int; _action text;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT count(*) + 1 INTO _n FROM public.content_violations
    WHERE user_id = _user_id AND reverted_at IS NULL;

  IF _n = 1 THEN
    _action := 'warning';
    PERFORM public.push_notification(_user_id, 'moderation_warning', 'Предупреждение за съдържание',
      'Съдържанието ти беше отхвърлено заради нарушение на правилата (' || _violation_type ||
      '). При повторно нарушение ще ограничим публикуването.', '/terms', NULL);
  ELSIF _n = 2 THEN
    _action := 'suspension_7d';
    UPDATE public.profiles SET suspended_until = now() + interval '7 days' WHERE id = _user_id;
    PERFORM public.push_notification(_user_id, 'account_suspended', 'Публикуването е спряно за 7 дни',
      'Това е второ нарушение на правилата за съдържание (' || _violation_type || ').', '/terms', NULL);
  ELSE
    _action := 'ban';
    PERFORM public.ban_user_cascade(_user_id, 'Трето нарушение на правилата за съдържание: ' || _violation_type);
  END IF;

  INSERT INTO public.content_violations (user_id, content_type, content_id, violation_type, severity, auto_detected, action_taken)
  VALUES (_user_id, _content_type, _content_id, _violation_type, COALESCE(_severity,'block'), COALESCE(_auto,true), _action);

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, details)
  VALUES (NULL, 'content_violation', _content_type, _content_id,
    jsonb_build_object('user_id', _user_id, 'violation', _violation_type, 'action', _action, 'count', _n, 'auto', _auto));

  RETURN jsonb_build_object('ok', true, 'count', _n, 'action', _action);
END; $$;

-- QUEUE HELPER
CREATE OR REPLACE FUNCTION public.enqueue_moderation(_kind text, _content_type text, _content_id uuid,
  _task_id uuid, _user_id uuid, _severity text, _reason text, _category text, _pattern text, _excerpt text, _details jsonb)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.moderation_items (kind, content_type, content_id, task_id, user_id, severity, reason, category, matched_pattern, excerpt, details)
  VALUES (_kind, _content_type, _content_id, _task_id, _user_id, COALESCE(_severity,'medium'), COALESCE(_reason,''),
    COALESCE(_category,''), _pattern, left(COALESCE(_excerpt,''), 400), COALESCE(_details,'{}'::jsonb))
  RETURNING id;
$$;

-- TASK TRIGGERS
CREATE OR REPLACE FUNCTION public.tasks_moderate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb; p record;
BEGIN
  SELECT banned_at, suspended_until INTO p FROM public.profiles WHERE id = NEW.user_id;
  IF p.banned_at IS NOT NULL THEN RAISE EXCEPTION 'ACCOUNT_BANNED'; END IF;
  IF p.suspended_until IS NOT NULL AND p.suspended_until > now() THEN RAISE EXCEPTION 'POSTING_SUSPENDED'; END IF;

  v := public.moderate_text(COALESCE(NEW.title,'') || E'\n' || COALESCE(NEW.description,''));
  IF v->>'verdict' = 'block' THEN
    PERFORM public.record_content_violation(NEW.user_id, 'task', NULL, v->>'category', 'block', true);
    RAISE EXCEPTION 'CONTENT_BLOCKED:%', v->>'category';
  END IF;

  IF v->>'verdict' = 'flag' OR public.needs_prepublish_review(NEW.user_id) THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tasks_moderate_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  v := public.moderate_text(COALESCE(NEW.title,'') || E'\n' || COALESCE(NEW.description,''));
  PERFORM public.enqueue_moderation('text', 'task', NEW.id, NEW.id, NEW.user_id,
    CASE WHEN v->>'verdict' = 'flag' THEN 'medium' ELSE 'low' END,
    CASE WHEN v->>'verdict' = 'flag' THEN 'Съвпадение с правило за съдържание' ELSE 'Нов профил — първа задача за преглед' END,
    COALESCE(v->>'category',''), v->>'pattern',
    COALESCE(NEW.title,'') || ' — ' || COALESCE(NEW.description,''),
    jsonb_build_object('trust', public.user_trust(NEW.user_id)));
  PERFORM public.push_notification(NEW.user_id, 'content_held', 'Задачата ти чака преглед',
    'Проверяваме „' || NEW.title || '“ преди да се появи публично. Обикновено отнема до няколко часа.',
    '/profile', NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tasks_moderate_trg ON public.tasks;
CREATE TRIGGER tasks_moderate_trg BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_moderate();
DROP TRIGGER IF EXISTS tasks_moderate_after_trg ON public.tasks;
CREATE TRIGGER tasks_moderate_after_trg AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_moderate_after();

-- MESSAGES
CREATE OR REPLACE FUNCTION public.messages_moderate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  v := public.moderate_text(NEW.content);
  IF v->>'verdict' = 'block' THEN
    PERFORM public.record_content_violation(NEW.sender_id, 'message', NULL, v->>'category', 'block', true);
    RAISE EXCEPTION 'CONTENT_BLOCKED:%', v->>'category';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.messages_moderate_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  v := public.moderate_text(NEW.content);
  IF v->>'verdict' = 'flag' THEN
    PERFORM public.enqueue_moderation('text', 'message', NEW.id, NEW.task_id, NEW.sender_id, 'medium',
      'Маркирано съобщение', COALESCE(v->>'category',''), v->>'pattern', NEW.content,
      jsonb_build_object('trust', public.user_trust(NEW.sender_id)));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS messages_moderate_trg ON public.messages;
CREATE TRIGGER messages_moderate_trg BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_moderate();
DROP TRIGGER IF EXISTS messages_moderate_after_trg ON public.messages;
CREATE TRIGGER messages_moderate_after_trg AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_moderate_after();

-- REVIEWS
CREATE OR REPLACE FUNCTION public.reviews_moderate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  v := public.moderate_text(NEW.comment);
  IF v->>'verdict' = 'block' THEN
    PERFORM public.record_content_violation(NEW.reviewer_id, 'review', NULL, v->>'category', 'block', true);
    RAISE EXCEPTION 'CONTENT_BLOCKED:%', v->>'category';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.reviews_moderate_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  v := public.moderate_text(NEW.comment);
  IF v->>'verdict' = 'flag' THEN
    PERFORM public.enqueue_moderation('text', 'review', NEW.id, NEW.task_id, NEW.reviewer_id, 'medium',
      'Маркиран отзив', COALESCE(v->>'category',''), v->>'pattern', NEW.comment,
      jsonb_build_object('trust', public.user_trust(NEW.reviewer_id)));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS reviews_moderate_trg ON public.reviews;
CREATE TRIGGER reviews_moderate_trg BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_moderate();
DROP TRIGGER IF EXISTS reviews_moderate_after_trg ON public.reviews;
CREATE TRIGGER reviews_moderate_after_trg AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_moderate_after();

-- TRUST RAISE ON CONFIRMED ENGAGEMENT
CREATE OR REPLACE FUNCTION public.engagements_trust()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    UPDATE public.profiles SET trust_level = trust_level + 1 WHERE id = NEW.professional_id;
    UPDATE public.profiles SET trust_level = trust_level + 1 WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS engagements_trust_trg ON public.engagements;
CREATE TRIGGER engagements_trust_trg AFTER INSERT OR UPDATE ON public.engagements
  FOR EACH ROW EXECUTE FUNCTION public.engagements_trust();

-- USER REPORTS (profiles, messages, and anything else)
CREATE OR REPLACE FUNCTION public.report_content(_content_type text, _content_id uuid, _reason text, _details text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _owner uuid; _excerpt text := ''; _task uuid; _id uuid;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  IF _content_type NOT IN ('profile','message','task','review') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;
  IF EXISTS (SELECT 1 FROM public.moderation_items m
    WHERE m.kind = 'report' AND m.content_type = _content_type AND m.content_id = _content_id
      AND m.reporter_id = _me AND m.status = 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DUPLICATE');
  END IF;

  IF _content_type = 'profile' THEN
    SELECT id INTO _owner FROM public.profiles WHERE id = _content_id;
  ELSIF _content_type = 'message' THEN
    SELECT sender_id, left(content, 300), task_id INTO _owner, _excerpt, _task
      FROM public.messages WHERE id = _content_id
        AND (sender_id = _me OR receiver_id = _me);
    IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  ELSIF _content_type = 'task' THEN
    SELECT user_id, left(title, 300), id INTO _owner, _excerpt, _task FROM public.tasks WHERE id = _content_id;
  ELSE
    SELECT reviewer_id, left(comment, 300), task_id INTO _owner, _excerpt, _task FROM public.reviews WHERE id = _content_id;
  END IF;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF _owner = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;

  INSERT INTO public.moderation_items (kind, content_type, content_id, task_id, user_id, reporter_id,
    severity, reason, category, excerpt, details)
  VALUES ('report', _content_type, _content_id, _task, _owner, _me, 'medium',
    COALESCE(_reason,'other'), COALESCE(_reason,'other'), _excerpt,
    jsonb_build_object('details', COALESCE(_details,''), 'trust', public.user_trust(_owner)))
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'id', _id);
END; $$;

-- ADMIN QUEUE
CREATE OR REPLACE FUNCTION public.admin_moderation_queue(_status text DEFAULT 'pending', _limit integer DEFAULT 100)
RETURNS TABLE(id uuid, kind text, content_type text, content_id uuid, task_id uuid, task_title text,
  user_id uuid, user_name text, reporter_id uuid, reporter_name text, severity text, status text,
  reason text, category text, matched_pattern text, excerpt text, details jsonb, created_at timestamptz,
  image_path text, moderation_score numeric, moderation_labels jsonb,
  account_age_days integer, trust_level integer, prior_violations bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT m.id, m.kind, m.content_type, m.content_id, m.task_id, t.title, m.user_id, pu.full_name,
    m.reporter_id, pr.full_name, m.severity, m.status, m.reason, m.category, m.matched_pattern,
    m.excerpt, m.details, m.created_at,
    ti.image_url, ti.moderation_score, ti.moderation_labels,
    GREATEST(EXTRACT(day FROM now() - pu.created_at)::int, 0), pu.trust_level,
    (SELECT count(*) FROM public.content_violations v WHERE v.user_id = m.user_id AND v.reverted_at IS NULL)
  FROM public.moderation_items m
  LEFT JOIN public.tasks t ON t.id = m.task_id
  LEFT JOIN public.profiles pu ON pu.id = m.user_id
  LEFT JOIN public.profiles pr ON pr.id = m.reporter_id
  LEFT JOIN public.task_images ti ON m.content_type = 'task_image' AND ti.id = m.content_id
  WHERE (_status IS NULL OR _status = 'all' OR m.status = _status)
  ORDER BY CASE m.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, m.created_at
  LIMIT COALESCE(_limit, 100);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_moderation(_item_id uuid, _approve boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); m public.moderation_items%ROWTYPE; _title text; _pending int;
BEGIN
  IF _me IS NULL OR NOT public.is_staff(_me) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  SELECT * INTO m FROM public.moderation_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF m.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_RESOLVED'); END IF;
  IF NOT _approve AND (_reason IS NULL OR length(trim(_reason)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;

  SELECT title INTO _title FROM public.tasks WHERE id = m.task_id;

  IF _approve THEN
    IF m.content_type = 'task_image' THEN
      UPDATE public.task_images SET moderation_status = 'approved' WHERE id = m.content_id;
    END IF;
    IF m.task_id IS NOT NULL THEN
      SELECT count(*) INTO _pending FROM public.task_images ti
        WHERE ti.task_id = m.task_id AND ti.moderation_status = 'pending' AND ti.id <> COALESCE(m.content_id, '00000000-0000-0000-0000-000000000000'::uuid);
      IF _pending = 0 AND EXISTS (SELECT 1 FROM public.tasks WHERE id = m.task_id AND status = 'pending')
         AND NOT EXISTS (SELECT 1 FROM public.moderation_items o WHERE o.task_id = m.task_id AND o.id <> m.id AND o.status = 'pending' AND o.kind <> 'report') THEN
        UPDATE public.tasks SET status = 'active', bumped_at = now() WHERE id = m.task_id;
        PERFORM public.push_notification(m.user_id, 'content_approved', 'Задачата ти е публикувана',
          '„' || COALESCE(_title,'Задача') || '“ премина проверката и вече е видима за изпълнителите.',
          '/task/' || m.task_id::text, m.task_id);
      END IF;
    END IF;
  ELSE
    IF m.content_type = 'task_image' THEN
      UPDATE public.task_images SET moderation_status = 'rejected' WHERE id = m.content_id;
      DELETE FROM public.task_images WHERE id = m.content_id;
    ELSIF m.content_type = 'review' THEN
      UPDATE public.reviews SET hidden_at = now(), hidden_reason = _reason WHERE id = m.content_id;
      PERFORM public.recompute_review_aggregates((SELECT reviewee_id FROM public.reviews WHERE id = m.content_id));
    ELSIF m.content_type IN ('task') AND m.task_id IS NOT NULL THEN
      UPDATE public.tasks SET status = 'inactive' WHERE id = m.task_id;
    END IF;

    PERFORM public.record_content_violation(m.user_id, m.content_type, m.content_id,
      COALESCE(NULLIF(m.category,''), 'other'), 'block', false);
    PERFORM public.push_notification(m.user_id, 'content_rejected', 'Съдържанието ти беше отхвърлено',
      _reason || ' Прегледай правилата за съдържание и поправи публикацията.', '/terms', m.task_id);
  END IF;

  UPDATE public.moderation_items
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        resolved_by = _me, resolved_at = now(), resolution_reason = _reason
    WHERE id = _item_id;

  PERFORM public.log_admin_action(CASE WHEN _approve THEN 'moderation_approved' ELSE 'moderation_rejected' END,
    m.content_type, m.content_id, jsonb_build_object('item_id', _item_id, 'reason', COALESCE(_reason,'')));

  RETURN jsonb_build_object('ok', true);
END; $$;

-- DASHBOARD STATS + moderation backlog
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'total_tasks', (SELECT count(*) FROM public.tasks),
    'active_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'active'),
    'assigned_tasks', (SELECT count(*) FROM public.tasks WHERE status = 'assigned'),
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
    'violations_30d', (SELECT count(*) FROM public.content_violations WHERE created_at > now() - interval '30 days')
  );
END; $$;

-- Hide non-active task images from public: tasks in 'pending' never reach feed_tasks (status='active' filter).
