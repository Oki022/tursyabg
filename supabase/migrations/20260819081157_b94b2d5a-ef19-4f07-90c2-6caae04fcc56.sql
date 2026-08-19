-- 1. Trigger functions: never callable via the API
REVOKE EXECUTE ON FUNCTION public.contact_messages_notify_staff(), public.contact_messages_rate_limit(),
  public.engagements_trust(), public.messages_moderate(), public.messages_moderate_after(),
  public.notify_new_message(), public.require_owner_phone(), public.reviews_moderate(),
  public.reviews_moderate_after(), public.reviews_sync_aggregates(), public.tasks_moderate(),
  public.tasks_moderate_after() FROM PUBLIC, anon, authenticated;

-- 2. Internal-only helpers: server/definer use only
REVOKE EXECUTE ON FUNCTION
  public.ban_user_cascade(uuid, text),
  public.enqueue_moderation(text, text, uuid, uuid, uuid, text, text, text, text, text, jsonb),
  public.evaluate_refund_rule(uuid, refund_reason),
  public.log_admin_action(text, text, uuid, jsonb),
  public.record_content_violation(uuid, text, uuid, text, text, boolean),
  public.recompute_review_aggregates(uuid),
  public.settle_refund(uuid, boolean, text, boolean, text),
  public.run_cron_job(text),
  public.sweep_engagements(integer),
  public.sweep_expiry_notifications(integer),
  public.moderate_text(text),
  public.is_refund_flagged(uuid),
  public.needs_prepublish_review(uuid)
FROM PUBLIC, anon, authenticated;

-- 3. Signed-in only functions: remove anonymous execute
REVOKE EXECUTE ON FUNCTION
  public.admin_adjust_credits(uuid, integer, text),
  public.admin_correct_task_category(uuid, text),
  public.admin_cron_health(),
  public.admin_daily_series(),
  public.admin_dashboard_stats(),
  public.admin_delete_task(uuid, text, boolean),
  public.admin_hide_review(uuid, text),
  public.admin_list_reviews(text, integer),
  public.admin_list_users(text, integer),
  public.admin_moderation_queue(text, integer),
  public.admin_refund_evidence(uuid),
  public.admin_resolve_moderation(uuid, boolean, text),
  public.admin_resolve_refund(uuid, boolean, text),
  public.admin_review_flags(),
  public.admin_set_ban(uuid, boolean, text),
  public.admin_set_contact_status(uuid, text, text),
  public.admin_set_role(uuid, app_role, boolean),
  public.admin_task_delete_preview(uuid),
  public.assign_engagement(uuid, uuid),
  public.claim_engagement(uuid),
  public.close_task(uuid, text),
  public.confirm_task_active(uuid),
  public.delete_own_task(uuid, text),
  public.my_engagements(),
  public.own_task_delete_preview(uuid),
  public.report_content(text, uuid, text, text),
  public.request_credit_refund(uuid, refund_reason, text),
  public.respond_engagement(uuid, boolean),
  public.reveal_engagement_reviews(uuid),
  public.submit_review(uuid, integer, text),
  public.task_unlockers(uuid),
  public.update_own_task(uuid, text, text, text, numeric, text, text),
  public.record_image_moderation(uuid, text, numeric, jsonb, text, boolean),
  public.user_trust(uuid),
  public.has_role(uuid, app_role),
  public.is_staff(uuid)
FROM PUBLIC, anon;

-- 4. credit_refund_requests: hide internal staff columns from table reads
REVOKE SELECT ON public.credit_refund_requests FROM authenticated, anon;
GRANT SELECT (id, unlock_id, user_id, reason, details, status, created_at, resolved_at)
  ON public.credit_refund_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_refunds(_status text DEFAULT 'all')
RETURNS TABLE(id uuid, status refund_status, reason refund_reason, details text, admin_note text,
  resolution text, auto_rule text, created_at timestamptz, resolved_at timestamptz,
  user_id uuid, user_name text, credits integer, task_id uuid, task_title text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT r.id, r.status, r.reason, r.details, r.admin_note, r.resolution, r.auto_rule,
    r.created_at, r.resolved_at, r.user_id, COALESCE(p.full_name, 'Потребител'),
    COALESCE(u.credits_spent, 0), u.task_id, COALESCE(t.title, 'Задача')
  FROM public.credit_refund_requests r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN public.task_unlocks u ON u.id = r.unlock_id
  LEFT JOIN public.tasks t ON t.id = u.task_id
  WHERE _status IS NULL OR _status = 'all' OR r.status::text = _status
  ORDER BY r.created_at DESC;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_refunds(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_refunds(text) TO authenticated;

-- 5. moderation_items: users no longer see detection internals
DROP POLICY IF EXISTS "own queue items" ON public.moderation_items;

-- 6. task_promotions: hide price and limit public reads to active promotions
DROP POLICY IF EXISTS task_promotions_public_read ON public.task_promotions;
CREATE POLICY task_promotions_active_read ON public.task_promotions
  FOR SELECT TO anon, authenticated USING (expires_at > now());
REVOKE SELECT ON public.task_promotions FROM anon, authenticated;
GRANT SELECT (id, task_id, user_id, promo_product_id, type, starts_at, expires_at, created_at)
  ON public.task_promotions TO anon, authenticated;
