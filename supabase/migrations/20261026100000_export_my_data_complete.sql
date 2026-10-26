-- "Изтегли моите данни": complete copy of the user's own data (GDPR access /
-- portability), so a request never needs manual work.
-- Added: e-mail, task subcategory, payment channel (card / Google Play / App
-- Store), messages the user sent, favourites, saved searches, notification
-- settings, contact-form messages, reports the user filed, app devices
-- (platform and dates only, never the push token).
-- Still only the caller's own rows; nothing about other people except what is
-- already inside the user's own content.

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at)
                  from auth.users u where u.id = _uid),
    'profile', (select to_jsonb(p) from (
        select id, full_name, avatar_url, city, neighborhood, credits, skill_categories, skill_tags,
               completed_jobs, rating_as_pro, review_count_as_pro, rating_as_client,
               review_count_as_client, trust_level, created_at, deactivated_at
          from public.profiles where id = _uid) p),
    'phone', (select phone from public.profile_contacts where user_id = _uid),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t)) from (
        select id, title, description, category, subcategory, budget, budget_range, currency, city,
               neighborhood, status, view_count, unlock_count, created_at, updated_at, expires_at,
               deleted_at
          from public.tasks where user_id = _uid order by created_at) t), '[]'::jsonb),
    'reviews_written', coalesce((select jsonb_agg(to_jsonb(r)) from (
        select id, task_id, rating, comment, direction, created_at
          from public.reviews where reviewer_id = _uid order by created_at) r), '[]'::jsonb),
    'reviews_received', coalesce((select jsonb_agg(to_jsonb(r)) from (
        select id, task_id, rating, comment, direction, created_at
          from public.reviews where reviewee_id = _uid and is_visible order by created_at) r), '[]'::jsonb),
    'credit_transactions', coalesce((select jsonb_agg(to_jsonb(c)) from (
        select id, amount, type, task_id, balance_after, description, created_at
          from public.credit_transactions where user_id = _uid order by created_at) c), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(pay)) from (
        select id, provider, kind, credits, amount_eur, currency, status, task_id, created_at,
               completed_at, refunded_at, receipt_url
          from public.payments where user_id = _uid order by created_at) pay), '[]'::jsonb),
    'unlocked_tasks', coalesce((select jsonb_agg(to_jsonb(u)) from (
        select id, task_id, credits_spent, unlocked_at, expires_at
          from public.task_unlocks where user_id = _uid order by unlocked_at) u), '[]'::jsonb),
    'messages_sent', coalesce((select jsonb_agg(to_jsonb(m)) from (
        select id, conversation_id, task_id, content, created_at, read_at
          from public.messages where sender_id = _uid order by created_at) m), '[]'::jsonb),
    'favourites', coalesce((select jsonb_agg(to_jsonb(f)) from (
        select task_id, created_at
          from public.favourites where user_id = _uid order by created_at) f), '[]'::jsonb),
    'saved_searches', coalesce((select jsonb_agg(to_jsonb(a)) from (
        select id, category, subcategories, region, city, created_at
          from public.task_alerts where user_id = _uid order by created_at) a), '[]'::jsonb),
    'notification_settings', (select to_jsonb(n) from (
        select tasks, messages, reviews, credits, promotions, moderation, updated_at
          from public.notification_preferences where user_id = _uid) n),
    'contact_messages', coalesce((select jsonb_agg(to_jsonb(cm)) from (
        select id, subject, body, status, created_at
          from public.contact_messages where user_id = _uid order by created_at) cm), '[]'::jsonb),
    'reports_filed', coalesce((select jsonb_agg(to_jsonb(tr)) from (
        select task_id, reason, created_at
          from public.task_reports where reporter_id = _uid order by created_at) tr), '[]'::jsonb),
    'app_devices', coalesce((select jsonb_agg(to_jsonb(d)) from (
        select platform, created_at, last_seen_at
          from public.push_devices where user_id = _uid order by created_at) d), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

notify pgrst, 'reload schema';
