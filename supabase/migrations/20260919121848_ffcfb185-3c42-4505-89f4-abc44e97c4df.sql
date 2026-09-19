ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS credit_transactions_counterparty_id_idx
  ON public.credit_transactions(counterparty_id);

UPDATE public.credit_transactions ct
SET counterparty_id = t.user_id
FROM public.tasks t
WHERE ct.task_id = t.id
  AND t.user_id <> ct.user_id
  AND ct.counterparty_id IS NULL;

CREATE OR REPLACE FUNCTION public.credit_transaction_set_counterparty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.task_id IS NOT NULL AND NEW.counterparty_id IS NULL THEN
    SELECT t.user_id INTO NEW.counterparty_id
    FROM public.tasks t
    WHERE t.id = NEW.task_id
      AND t.user_id <> NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_credit_transaction_set_counterparty ON public.credit_transactions;
CREATE TRIGGER trg_credit_transaction_set_counterparty
BEFORE INSERT ON public.credit_transactions
FOR EACH ROW EXECUTE FUNCTION public.credit_transaction_set_counterparty();