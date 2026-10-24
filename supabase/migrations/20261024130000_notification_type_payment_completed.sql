-- New notification type for a completed payment (points added / promotion paid).
-- Separate file: a new enum value cannot be used in the same transaction.
alter type public.notification_type add value if not exists 'payment_completed';
