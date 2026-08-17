CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.credit_packages(id),
  credits integer NOT NULL DEFAULT 0,
  amount_eur numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  provider text NOT NULL DEFAULT 'stripe',
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  refunded_at timestamptz
);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_payments_user ON public.payments(user_id, created_at DESC);
CREATE INDEX idx_payments_intent ON public.payments(stripe_payment_intent_id);

CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  event_id text NOT NULL,
  event_type text NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_provider_event_unique UNIQUE (provider, event_id)
);

GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.complete_payment(
  _session_id text,
  _payment_intent text,
  _receipt_url text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments%ROWTYPE;
  new_balance integer;
BEGIN
  SELECT * INTO p FROM public.payments WHERE stripe_session_id = _session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_FOUND');
  END IF;
  IF p.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  UPDATE public.profiles
    SET credits = credits + p.credits
    WHERE id = p.user_id
    RETURNING credits INTO new_balance;

  INSERT INTO public.credit_transactions (user_id, amount, type, package_id, balance_after, description)
  VALUES (p.user_id, p.credits, 'purchase', p.package_id, new_balance, 'Покупка на кредити');

  UPDATE public.payments
    SET status = 'completed',
        completed_at = now(),
        stripe_payment_intent_id = COALESCE(_payment_intent, stripe_payment_intent_id),
        receipt_url = COALESCE(_receipt_url, receipt_url)
    WHERE id = p.id;

  RETURN jsonb_build_object('ok', true, 'already', false, 'balance', new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_payment(
  _payment_intent text,
  _status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments%ROWTYPE;
  new_balance integer;
BEGIN
  SELECT * INTO p FROM public.payments WHERE stripe_payment_intent_id = _payment_intent FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_FOUND');
  END IF;
  IF p.status IN ('refunded', 'disputed') THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  UPDATE public.profiles
    SET credits = GREATEST(credits - p.credits, 0)
    WHERE id = p.user_id
    RETURNING credits INTO new_balance;

  INSERT INTO public.credit_transactions (user_id, amount, type, package_id, balance_after, description)
  VALUES (p.user_id, -p.credits, 'refund', p.package_id, new_balance,
          CASE WHEN _status = 'disputed' THEN 'Оспорено плащане — кредитите са отнети'
               ELSE 'Възстановено плащане — кредитите са отнети' END);

  UPDATE public.payments
    SET status = _status, refunded_at = now()
    WHERE id = p.id;

  RETURN jsonb_build_object('ok', true, 'already', false, 'balance', new_balance);
END;
$$;

UPDATE public.credit_packages SET price_eur = 6.99, updated_at = now() WHERE credits = 25;