-- Sync migration: objects that exist in the live database but were never
-- committed as migrations. Idempotent, safe to run on any environment.
-- No application behaviour changes.

-- 1) Seed data: promo products (were inserted directly into the live database).
insert into public.promo_products (code, name_bg, type, duration_days, price_eur, sort_order, is_active)
values
  ('bump',     'Обнови обявата', 'bump',    0,  0.99, 1, true),
  ('urgent_3', 'Спешно',         'urgent',  3,  1.99, 2, true),
  ('top_3',    'ТОП обява',      'top',     3,  2.99, 3, true),
  ('top_7',    'ТОП обява',      'top',     7,  4.99, 4, true),
  ('top_14',   'ТОП обява',      'top',    14,  8.99, 5, true)
on conflict (code) do update
  set name_bg = excluded.name_bg,
      type = excluded.type,
      duration_days = excluded.duration_days,
      price_eur = excluded.price_eur,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active;

-- 2) EXECUTE privileges on RPCs the app calls. Earlier migrations revoked
--    EXECUTE from PUBLIC without re-granting to authenticated; the live
--    database has these grants, so without them the app breaks.
do $$
declare
  fn text;
  names text[] := array[
    'admin_adjust_credits','admin_cron_health','admin_daily_series','admin_dashboard_stats',
    'admin_delete_task','admin_hide_review','admin_list_reviews','admin_list_users',
    'admin_moderation_queue','admin_refund_evidence','admin_resolve_refund','admin_review_flags',
    'admin_set_ban','admin_set_role','admin_task_delete_preview',
    'assign_engagement','claim_engagement','close_task','confirm_task_active',
    'has_role','is_staff','record_image_moderation','report_content','respond_engagement',
    'submit_review','task_unlockers'
  ];
begin
  for fn in
    select 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = any(names)
  loop
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Notes (no SQL needed / not expressible here):
-- * The private storage bucket 'task-images' must exist. It is created through
--   the Storage API, not SQL (INSERT INTO storage.buckets is not allowed in
--   migrations). Create it manually on a fresh instance: bucket id
--   'task-images', public = false. Its RLS policies on storage.objects are
--   already in earlier migrations.
-- * There is no trigger or function in the auth schema in the live database
--   (no handle_new_user). Profile rows are created by the application on first
--   sign-in, so nothing is missing there.
-- * profiles has no phone column in the live database either; phone numbers
--   live in public.profile_contacts.
-- * The live database additionally has Supabase's default blanket table grants
--   to anon/authenticated on the public schema. They are intentionally not
--   reproduced here: RLS governs access and the per-table grants in the
--   committed migrations are stricter and sufficient.