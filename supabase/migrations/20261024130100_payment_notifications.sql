-- After every completed payment (card on the site, Google Play, App Store) the
-- user gets an in-app notification, which also goes to the phone as a push.
-- Payment notifications are always delivered (not switched off by settings).
create or replace function public.payments_notify_completed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _amount text := replace(to_char(new.amount_eur, 'FM999990.00'), '.', ',') || ' €';
  _name text;
begin
  if new.status <> 'completed' or new.completed_at is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then
    return null;
  end if;

  if new.kind = 'promotion' then
    select name_bg into _name from public.promo_products where id = new.promo_product_id;
    perform public.push_notification(
      new.user_id,
      'payment_completed'::public.notification_type,
      'Плащането е получено',
      coalesce(_name, 'Промоция') || ' за ' || _amount || '. Промоцията се активира за обявата ти.',
      case when new.task_id is not null then '/task/' || new.task_id::text else '/settings/billing' end,
      new.task_id
    );
  else
    perform public.push_notification(
      new.user_id,
      'payment_completed'::public.notification_type,
      'Точките са добавени',
      '+' || new.credits || ' точки за ' || _amount || '. Благодарим за покупката!',
      '/settings/billing',
      null
    );
  end if;
  return null;
exception when others then
  -- A notification problem must never undo a payment.
  return null;
end;
$$;

revoke all on function public.payments_notify_completed() from public, anon, authenticated;

drop trigger if exists trg_payments_notify_completed on public.payments;
create trigger trg_payments_notify_completed
  after insert or update of status on public.payments
  for each row execute function public.payments_notify_completed();
