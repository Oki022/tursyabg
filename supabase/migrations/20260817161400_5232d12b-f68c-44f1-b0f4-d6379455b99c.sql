ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_still_open';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_freshness';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'refund_auto_approved';