-- New in-app notification type for the daily "new tasks for you" digest.
-- Kept in its own migration: a new enum value cannot be used in the same
-- transaction that adds it.
alter type public.notification_type add value if not exists 'task_alert';
