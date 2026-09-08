ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'credits_adjusted';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'account_restored';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_removed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_category_changed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_removed';