-- K1 — KURCALANAMAZ ATIF (attribution integrity)
-- Sorun (denetim S1/S8): referral_clicks anon INSERT (CHECK true) + anon SELECT (USING true)
--   → (a) herkes rastgele partnership_id ile SAHTE tık basabiliyor (istatistik şişirme),
--     (b) herkes TÜM ref_code/partnership_id'yi okuyup rakip ortağın linkini hasat edebiliyor.
-- Money-core (record_sale/commissions/compute_agreed_commission/guard_commission_paid) ZATEN
-- sunucu-otoriter ve kilitli → dokunulmuyor. Bu migration YALNIZ tık-kayıt bütünlüğünü sertleştirir:
--   1) Tık yalnız GERÇEK + aktif bir partnership'e (ref_code eşleşmeli) kaydedilebilir → sahte enjeksiyon biter.
--   2) referral_clicks doğrudan yazma/okuma anon'a kapatılır; yazım YALNIZ doğrulamalı SECURITY DEFINER RPC üzerinden.
--   3) Okuma yalnız ilgili ortak (kendi partnership'i) veya ilan sahibine açık → ref_code hasadı biter.
-- throttle_referral_clicks (BEFORE INSERT) hız-limiti korunur (RPC insert'inde de tetiklenir).

-- 1) Sunucu-doğrulamalı tık kaydı. Mevcut istemci çağrısıyla uyumlu imza (partnership_id, ref_code, channel).
create or replace function public.record_referral_click(
  p_partnership_id uuid,
  p_ref_code text default null,
  p_channel text default 'link'
) returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_listing uuid;
begin
  if p_partnership_id is null then
    return;
  end if;
  -- partnership GERÇEK + AKTİF olmalı; ref_code verildiyse EŞLEŞMELİ. Aksi halde sessizce yok say
  -- (geçersiz/pasif/sahte partnership_id ile tık ENJEKTE EDİLEMEZ; listing_id sunucudan türetilir).
  select p.listing_id
    into v_listing
    from public.partnerships p
    join public.listings l on l.id = p.listing_id
   where p.id = p_partnership_id
     and p.status = 'active'
     and l.status = 'active'
     and l.deleted_at is null
     and (p_ref_code is null or p.ref_code = p_ref_code)
   limit 1;

  if v_listing is null then
    return;
  end if;

  insert into public.referral_clicks (listing_id, partnership_id, ref_code, channel)
  values (v_listing, p_partnership_id, p_ref_code, coalesce(nullif(btrim(p_channel), ''), 'link'));
end
$fn$;

grant execute on function public.record_referral_click(uuid, text, text) to anon, authenticated;

-- 2) Eski gevşek politikaları kaldır (anon serbest yazma + serbest okuma).
drop policy if exists "rc public insert" on public.referral_clicks;
drop policy if exists "rc public read" on public.referral_clicks;

-- 3) Okuma: yalnız ilgili ortak (kendi partnership'i) VEYA ilan sahibi.
--    Public/anon sayımlar zaten SECURITY DEFINER fonksiyonlardan (partner_public_shop /
--    partner_leaderboard_rows) gelir; bu kısıt onları etkilemez.
create policy "rc partner or owner reads clicks" on public.referral_clicks
  for select
  using (
    exists (
      select 1 from public.partnerships p
       where p.id = referral_clicks.partnership_id
         and p.partner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.listings l
       where l.id = referral_clicks.listing_id
         and l.owner_id = (select auth.uid())
    )
  );

-- 4) Doğrudan INSERT yetkisini çek → yazım yalnız SECURITY DEFINER RPC ile (o, revoke'tan etkilenmez).
revoke insert on public.referral_clicks from anon, authenticated;
