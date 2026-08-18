-- ============================================================================
-- 2026-08-18 — Telefonsuz atıf-lead'lerinin ÇARPIŞMASI (HIGH, denetim)
-- ============================================================================
-- BUG: leads tekil index'i (20260725110000) `(listing_id, right(regexp_replace(buyer_phone,
-- '[^0-9]','','g'),10)) where status <> 'lost'`. Anonim/telefonsuz ortak-atıflı ziyaretçiler
-- buyer_phone '-' (ya da boş) gönderir → normalize → '' → o ilandaki HER telefonsuz lead AYNI
-- (listing_id, '') anahtarına düşer, FARKLI ortaklar arası bile. İlk telefonsuz lead geçer;
-- sonraki HER FARKLI telefonsuz alıcı 23505 ile SESSİZCE düşürülür (insertReferralLead void +
-- yalnız console.warn) → atıf satırı yok, ORTAK KOMİSYON HAKKI KAYBOLUR (para/adalet çekirdeği).
--
-- ÇÖZÜM: normalize-boş (rakamsız) telefonları tekillik kısıtından ÇIKAR → farklı telefonsuz
-- alıcılar çakışmadan atıf alır. (Aynı telefonsuz alıcının nadir tekrar-lead'i tolere edilir;
-- veri KAYBINDAN iyidir + istemci contactLeadDone oturum-içi tekrarı zaten engeller.)
-- Telefonlu lead'lerde "ilk ortak kazanır" dedup'u AYNEN korunur.
drop index if exists public.leads_listing_phone_uniq;
create unique index if not exists leads_listing_phone_uniq
  on public.leads (listing_id, right(regexp_replace(buyer_phone, '[^0-9]', '', 'g'), 10))
  where status <> 'lost'
    and right(regexp_replace(buyer_phone, '[^0-9]', '', 'g'), 10) <> '';

-- is_lead_available: rakamsız (boş normalize) telefon HER ZAMAN müsait (artık dedup edilmiyor).
create or replace function public.is_lead_available(p_listing_id uuid, p_buyer_phone text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case
    when right(regexp_replace(p_buyer_phone, '[^0-9]', '', 'g'), 10) = '' then true
    else not exists (
      select 1 from public.leads
       where listing_id = p_listing_id
         and status <> 'lost'
         and right(regexp_replace(buyer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(p_buyer_phone, '[^0-9]', '', 'g'), 10)
    )
  end;
$fn$;
grant execute on function public.is_lead_available(uuid, text) to authenticated;
