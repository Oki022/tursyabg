-- 1. promo products catalogue
CREATE TYPE public.promo_type AS ENUM ('bump', 'urgent', 'top');

CREATE TABLE public.promo_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_bg text NOT NULL,
  type public.promo_type NOT NULL,
  duration_days integer NOT NULL DEFAULT 0,
  price_eur numeric NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promo_products TO anon, authenticated;
GRANT ALL ON public.promo_products TO service_role;
ALTER TABLE public.promo_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_products_public_read ON public.promo_products FOR SELECT USING (is_active);

CREATE TRIGGER promo_products_set_updated_at BEFORE UPDATE ON public.promo_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. tasks.bumped_at
ALTER TABLE public.tasks ADD COLUMN bumped_at timestamptz;
UPDATE public.tasks SET bumped_at = created_at WHERE bumped_at IS NULL;
ALTER TABLE public.tasks ALTER COLUMN bumped_at SET DEFAULT now();
ALTER TABLE public.tasks ALTER COLUMN bumped_at SET NOT NULL;
CREATE INDEX tasks_bumped_at_idx ON public.tasks (bumped_at DESC);

-- 3. task promotions
CREATE TABLE public.task_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  promo_product_id uuid REFERENCES public.promo_products(id),
  type public.promo_type NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now(),
  price_paid_eur numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_promotions_task_expires_idx ON public.task_promotions (task_id, expires_at DESC);
CREATE INDEX task_promotions_type_expires_idx ON public.task_promotions (type, expires_at DESC);

GRANT SELECT ON public.task_promotions TO anon, authenticated;
GRANT ALL ON public.task_promotions TO service_role;
ALTER TABLE public.task_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_promotions_public_read ON public.task_promotions FOR SELECT USING (true);
CREATE POLICY task_promotions_owner_insert ON public.task_promotions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
  );

-- 4. payments can pay for a promotion
ALTER TABLE public.payments
  ADD COLUMN kind text NOT NULL DEFAULT 'credits',
  ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN promo_product_id uuid REFERENCES public.promo_products(id);

-- 5. bump rate limit helper
CREATE OR REPLACE FUNCTION public.can_bump_task(_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.task_promotions p
    WHERE p.task_id = _task_id AND p.type = 'bump' AND p.created_at > now() - interval '24 hours'
  );
$$;

-- 6. apply a purchased promotion (called by the verified webhook via service role)
CREATE OR REPLACE FUNCTION public.complete_promotion_payment(_session_id text, _payment_intent text, _receipt_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments%ROWTYPE;
  prod public.promo_products%ROWTYPE;
  _expires timestamptz;
  _promo_id uuid;
BEGIN
  SELECT * INTO p FROM public.payments WHERE stripe_session_id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_FOUND'); END IF;
  IF p.status = 'completed' THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  SELECT * INTO prod FROM public.promo_products WHERE id = p.promo_product_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'PROMO_NOT_FOUND'); END IF;

  IF prod.type = 'bump' THEN
    UPDATE public.tasks SET bumped_at = now() WHERE id = p.task_id;
    _expires := now();
  ELSE
    SELECT GREATEST(now(), COALESCE(MAX(tp.expires_at), now())) INTO _expires
      FROM public.task_promotions tp
      WHERE tp.task_id = p.task_id AND tp.type = prod.type AND tp.expires_at > now();
    _expires := _expires + make_interval(days => prod.duration_days);
  END IF;

  INSERT INTO public.task_promotions (task_id, user_id, promo_product_id, type, starts_at, expires_at, price_paid_eur)
  VALUES (p.task_id, p.user_id, prod.id, prod.type, now(), _expires, p.amount_eur)
  RETURNING id INTO _promo_id;

  UPDATE public.payments
    SET status = 'completed',
        completed_at = now(),
        stripe_payment_intent_id = COALESCE(_payment_intent, stripe_payment_intent_id),
        receipt_url = COALESCE(_receipt_url, receipt_url)
    WHERE id = p.id;

  RETURN jsonb_build_object('ok', true, 'already', false, 'promotion_id', _promo_id, 'expires_at', _expires);
END;
$$;

-- 7. feed with rotating promoted slots + cursor pagination
CREATE OR REPLACE FUNCTION public.feed_tasks(
  _limit integer DEFAULT 20,
  _cursor timestamptz DEFAULT NULL,
  _seed text DEFAULT 'seed',
  _promo_offset integer DEFAULT 0,
  _category text DEFAULT NULL,
  _city text DEFAULT NULL,
  _neighborhood text DEFAULT NULL,
  _q text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  budget numeric,
  city text,
  neighborhood text,
  status public.task_status,
  unlock_cost integer,
  created_at timestamptz,
  bumped_at timestamptz,
  user_id uuid,
  author text,
  images text[],
  is_top boolean,
  is_urgent boolean,
  promo_expires_at timestamptz,
  promoted_slot boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH base AS (
    SELECT t.*
    FROM public.tasks t
    WHERE t.status = 'active'
      AND (_category IS NULL OR t.category = _category)
      AND (_city IS NULL OR t.city = _city)
      AND (_neighborhood IS NULL OR t.neighborhood = _neighborhood)
      AND (
        _q IS NULL OR _q = ''
        OR t.title ILIKE '%' || _q || '%'
        OR t.description ILIKE '%' || _q || '%'
      )
  ),
  tops AS (
    SELECT b.*, tp.expires_at AS top_expires
    FROM base b
    JOIN LATERAL (
      SELECT MAX(p.expires_at) AS expires_at
      FROM public.task_promotions p
      WHERE p.task_id = b.id AND p.type = 'top' AND p.expires_at > now()
    ) tp ON tp.expires_at IS NOT NULL
  ),
  promoted AS (
    SELECT * FROM tops
    ORDER BY md5(_seed || tops.id::text)
    LIMIT LEAST(GREATEST(_limit, 1), 4) OFFSET GREATEST(_promo_offset, 0)
  ),
  normal AS (
    SELECT b.* FROM base b
    WHERE NOT EXISTS (SELECT 1 FROM tops t WHERE t.id = b.id)
      AND (_cursor IS NULL OR b.bumped_at < _cursor)
    ORDER BY b.bumped_at DESC
    LIMIT GREATEST(_limit, 1)
  ),
  combined AS (
    SELECT p.*, true AS promoted_slot, 0 AS ord FROM promoted p
    UNION ALL
    SELECT n.*, NULL::timestamptz AS top_expires, false AS promoted_slot, 1 AS ord FROM normal n
  )
  SELECT
    c.id,
    c.title,
    c.description,
    c.category,
    c.budget,
    c.city,
    c.neighborhood,
    c.status,
    c.unlock_cost,
    c.created_at,
    c.bumped_at,
    c.user_id,
    pr.full_name AS author,
    COALESCE(
      (SELECT array_agg(i.image_url ORDER BY i.sort_order) FROM public.task_images i WHERE i.task_id = c.id),
      ARRAY[]::text[]
    ) AS images,
    (c.top_expires IS NOT NULL) AS is_top,
    EXISTS (
      SELECT 1 FROM public.task_promotions u
      WHERE u.task_id = c.id AND u.type = 'urgent' AND u.expires_at > now()
    ) AS is_urgent,
    c.top_expires AS promo_expires_at,
    c.promoted_slot
  FROM combined c
  LEFT JOIN public.profiles pr ON pr.id = c.user_id
  ORDER BY c.ord, (CASE WHEN c.ord = 0 THEN md5(_seed || c.id::text) ELSE NULL END), c.bumped_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.feed_tasks(integer, timestamptz, text, integer, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_bump_task(uuid) TO anon, authenticated;