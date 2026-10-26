-- New values used by 20261026120100_credit_expiry.sql (separate file: a new
-- enum value can be used only after the transaction that adds it).
alter type public.credit_transaction_type add value if not exists 'expire';
alter type public.notification_type add value if not exists 'credits_expiring';
