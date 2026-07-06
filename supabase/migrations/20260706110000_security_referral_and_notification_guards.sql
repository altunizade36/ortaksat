-- ============================================================================
-- 2026-07-06 — Güvenlik: referral tıklama flood + bildirim aktör damgası/limiti
-- (newsletter zaten unique(email) ile korunuyor → değişiklik yok.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) referral_clicks: anonim herkese-açık insert → bot ile tıklama şişirme /
--    DB bloat. ref_code başına dakikada 100'den fazla tıklamayı SESSİZCE yut
--    (gerçek viral trafiğe izin verir, kitlesel botu keser). BEFORE trigger'da
--    RETURN NULL satırı eklemeden atar (client fire-and-forget, hata görmez).
-- ---------------------------------------------------------------------------
create or replace function private.throttle_referral_clicks()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.ref_code is not null and (
    select count(*) from public.referral_clicks
    where ref_code = new.ref_code and created_at > now() - interval '1 minute'
  ) >= 100 then
    return null; -- satır eklenmez, hata da yok
  end if;
  return new;
end;
$fn$;

drop trigger if exists throttle_referral_clicks on public.referral_clicks;
create trigger throttle_referral_clicks
  before insert on public.referral_clicks
  for each row execute function private.throttle_referral_clicks();

create index if not exists referral_clicks_refcode_time on public.referral_clicks(ref_code, created_at);

-- ---------------------------------------------------------------------------
-- 2) notifications: client herhangi bir user_id için bildirim ekleyebiliyor
--    (uygulama cross-user notify'a dayanıyor). E-posta zaten generic+limitli;
--    burada İN-APP kötüye kullanımı sınırla + izini tut:
--    - actor_id = auth.uid() GÜVENLİ damga (client değeri yok sayılır) → denetim.
--    - Bir aktör BAŞKALARI için saatte >100 bildirim üretemez (kitlesel spam).
--    Servis/definer (auth.uid null), admin ve kendine bildirim serbest.
--    Not: insertNotification fire-and-forget → limit aşımı çekirdek eylemi kırmaz.
-- ---------------------------------------------------------------------------
alter table public.notifications add column if not exists actor_id uuid;

create or replace function private.guard_notification_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_recent int;
begin
  new.actor_id := auth.uid();
  if auth.uid() is null or public.is_admin() or new.user_id = auth.uid() then
    return new;
  end if;
  select count(*) into v_recent from public.notifications
    where actor_id = auth.uid() and user_id <> auth.uid()
      and created_at > now() - interval '1 hour';
  if v_recent >= 100 then
    raise exception 'Notification rate limit exceeded';
  end if;
  return new;
end;
$fn$;

drop trigger if exists guard_notification_insert on public.notifications;
create trigger guard_notification_insert
  before insert on public.notifications
  for each row execute function private.guard_notification_insert();

create index if not exists notifications_actor_time on public.notifications(actor_id, created_at);
