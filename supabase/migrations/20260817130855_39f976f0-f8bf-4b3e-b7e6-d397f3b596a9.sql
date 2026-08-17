-- 1. profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_tasks_used_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_tasks_reset_at timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month');

-- 2. private contacts table (phone moves out of publicly readable profiles)
CREATE TABLE IF NOT EXISTS public.profile_contacts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.profile_contacts (user_id, phone)
  SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL
  ON CONFLICT (user_id) DO NOTHING;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

GRANT SELECT, INSERT, UPDATE ON public.profile_contacts TO authenticated;
GRANT ALL ON public.profile_contacts TO service_role;
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profile_contacts_set_updated_at BEFORE UPDATE ON public.profile_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. credit packages
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_eur numeric(10,2) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_packages TO anon, authenticated;
GRANT ALL ON public.credit_packages TO service_role;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_packages_public_read ON public.credit_packages FOR SELECT USING (is_active);
CREATE TRIGGER credit_packages_set_updated_at BEFORE UPDATE ON public.credit_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.credit_packages (name, credits, price_eur, sort_order) VALUES
  ('Старт', 25, 5.99, 1),
  ('Плюс', 60, 12.99, 2),
  ('Про', 150, 29.99, 3),
  ('Бизнес', 400, 69.99, 4);

-- 4. enums
DO $$ BEGIN
  CREATE TYPE public.credit_transaction_type AS ENUM ('purchase','unlock','refund','bonus','promo_spend');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.refund_reason AS ENUM ('fake_task','already_taken','no_response','wrong_category','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.refund_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. ledger
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type public.credit_transaction_type NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  package_id uuid REFERENCES public.credit_packages(id) ON DELETE SET NULL,
  balance_after integer NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_transactions_user_created_idx ON public.credit_transactions (user_id, created_at DESC);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_transactions_own_read ON public.credit_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 6. unlocks
CREATE TABLE IF NOT EXISTS public.task_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credits_spent integer NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 months'),
  UNIQUE (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS task_unlocks_user_idx ON public.task_unlocks (user_id, unlocked_at DESC);
GRANT SELECT ON public.task_unlocks TO authenticated;
GRANT ALL ON public.task_unlocks TO service_role;
ALTER TABLE public.task_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_unlocks_own_read ON public.task_unlocks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 7. refund requests
CREATE TABLE IF NOT EXISTS public.credit_refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_id uuid NOT NULL REFERENCES public.task_unlocks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason public.refund_reason NOT NULL,
  details text NOT NULL DEFAULT '',
  status public.refund_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (unlock_id)
);
CREATE INDEX IF NOT EXISTS credit_refund_requests_user_idx ON public.credit_refund_requests (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.credit_refund_requests TO authenticated;
GRANT ALL ON public.credit_refund_requests TO service_role;
ALTER TABLE public.credit_refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_refund_requests_own_read ON public.credit_refund_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY credit_refund_requests_own_insert ON public.credit_refund_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.task_unlocks u
      WHERE u.id = unlock_id AND u.user_id = auth.uid() AND u.unlocked_at > now() - interval '14 days'
    )
  );

-- 8. contacts RLS (needs task_unlocks to exist)
CREATE POLICY profile_contacts_self ON public.profile_contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY profile_contacts_unlocked_read ON public.profile_contacts FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.task_unlocks u
    JOIN public.tasks t ON t.id = u.task_id
    WHERE u.user_id = auth.uid() AND t.user_id = profile_contacts.user_id AND u.expires_at > now()
  )
);
CREATE POLICY profile_contacts_self_insert ON public.profile_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY profile_contacts_self_update ON public.profile_contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. unlock cost
CREATE OR REPLACE FUNCTION public.get_unlock_cost(task_budget numeric)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN task_budget IS NULL OR task_budget <= 100 THEN 5
    WHEN task_budget <= 300 THEN 10
    WHEN task_budget <= 800 THEN 20
    WHEN task_budget <= 2000 THEN 35
    WHEN task_budget <= 5000 THEN 55
    ELSE 80
  END;
$$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS unlock_cost integer GENERATED ALWAYS AS (public.get_unlock_cost(budget)) STORED;

-- 10. contact masking
CREATE OR REPLACE FUNCTION public.mask_contacts(input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE out text := input;
BEGIN
  IF out IS NULL THEN RETURN NULL; END IF;
  -- normalise Cyrillic/lookalike digits used to dodge filters
  out := translate(out, 'ОоІіЗзбB', '00110366');
  -- emails
  out := regexp_replace(out, '[[:alnum:]._%+-]+\s*(@|\(at\)|\[at\]|\s+at\s+)\s*[[:alnum:].-]+\.[a-zA-Z]{2,}', '•••', 'gi');
  -- written-out digits (Bulgarian) sequences of 6+
  out := regexp_replace(out, '((нула|едно|две|три|четири|пет|шест|седем|осем|девет)[[:space:],.-]*){6,}', '•••', 'gi');
  -- +359 / 00359 / 0 prefixed numbers with optional separators
  out := regexp_replace(out, '(\+|00)?\s*3\s*5\s*9([[:space:].()\-/]*[0-9]){8,9}', '•••', 'g');
  out := regexp_replace(out, '0([[:space:].()\-/]*[0-9]){8,}', '•••', 'g');
  -- any remaining long digit run
  out := regexp_replace(out, '([0-9][[:space:].()\-/]*){9,}', '•••', 'g');
  RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION public.tasks_mask_contacts()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.title := public.mask_contacts(NEW.title);
  NEW.description := public.mask_contacts(NEW.description);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tasks_mask_contacts_trg ON public.tasks;
CREATE TRIGGER tasks_mask_contacts_trg BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_mask_contacts();

CREATE OR REPLACE FUNCTION public.messages_mask_contacts()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.content := public.mask_contacts(NEW.content);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messages_mask_contacts_trg ON public.messages;
CREATE TRIGGER messages_mask_contacts_trg BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_mask_contacts();

-- 11. free posting limit
CREATE OR REPLACE FUNCTION public.enforce_free_task_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  SELECT credits, free_tasks_used_this_month, free_tasks_reset_at INTO p
    FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  IF p.free_tasks_reset_at <= now() THEN
    UPDATE public.profiles
      SET free_tasks_used_this_month = 0,
          free_tasks_reset_at = date_trunc('month', now()) + interval '1 month'
      WHERE id = NEW.user_id;
    p.free_tasks_used_this_month := 0;
  END IF;

  IF p.free_tasks_used_this_month >= 5 THEN
    RAISE EXCEPTION 'FREE_TASK_LIMIT_REACHED';
  END IF;

  UPDATE public.profiles
    SET free_tasks_used_this_month = free_tasks_used_this_month + 1
    WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tasks_free_limit_trg ON public.tasks;
CREATE TRIGGER tasks_free_limit_trg BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_task_limit();

-- 12. unlock RPC
CREATE OR REPLACE FUNCTION public.unlock_task_contact(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _task record;
  _existing record;
  _cost int;
  _balance int;
  _unlock_id uuid;
  _phone text;
  _name text;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;

  SELECT id, user_id, status, budget INTO _task FROM public.tasks WHERE id = _task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_FOUND'); END IF;
  IF _task.user_id = _me THEN RETURN jsonb_build_object('ok', false, 'error', 'OWN_TASK'); END IF;

  SELECT full_name INTO _name FROM public.profiles WHERE id = _task.user_id;
  SELECT phone INTO _phone FROM public.profile_contacts WHERE user_id = _task.user_id;

  SELECT * INTO _existing FROM public.task_unlocks WHERE task_id = _task_id AND user_id = _me;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'phone', _phone, 'name', _name,
      'credits_spent', _existing.credits_spent, 'unlock_id', _existing.id);
  END IF;

  IF _task.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'TASK_NOT_ACTIVE'); END IF;

  _cost := public.get_unlock_cost(_task.budget);

  SELECT credits INTO _balance FROM public.profiles WHERE id = _me FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_CREDITS', 'cost', _cost, 'balance', coalesce(_balance,0));
  END IF;

  UPDATE public.profiles SET credits = credits - _cost WHERE id = _me RETURNING credits INTO _balance;

  INSERT INTO public.task_unlocks (task_id, user_id, credits_spent)
    VALUES (_task_id, _me, _cost) RETURNING id INTO _unlock_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, task_id, balance_after, description)
    VALUES (_me, -_cost, 'unlock', _task_id, _balance, 'Отключен контакт по задача');

  RETURN jsonb_build_object('ok', true, 'already', false, 'phone', _phone, 'name', _name,
    'credits_spent', _cost, 'balance', _balance, 'unlock_id', _unlock_id);
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_task_contact(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unlock_task_contact(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.enforce_free_task_limit() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_mask_contacts() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.messages_mask_contacts() FROM public, anon, authenticated;