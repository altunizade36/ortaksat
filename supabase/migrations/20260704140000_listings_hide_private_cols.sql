-- =====================================================================
-- Ham listings tablosunda anon'a kapatılan özel kolonlar
-- =====================================================================
-- SORUN: public.listings anon'a tüm kolonlarıyla SELECT açıktı. App public
-- gösterim için listing_public_cards view'ını kullanır; ham tabloyu yalnızca
-- giriş yapmış kullanıcı (kendi ilanları) okur. Ancak anon doğrudan ham tabloyu
-- okuyabildiği için moderation_note (admin notu), moderation_status, location_note
-- (özel adres notu) ve konum id'leri sızabiliyordu.
--
-- ÇÖZÜM: listing_public_cards view'ı security_invoker=true olduğundan anon'un
-- view'ın okuduğu kolonlara erişimi GEREKİR. Tablo-seviyesi SELECT'i geri alıp
-- yalnızca view'ın kullandığı 28 public kolonu anon'a veriyoruz. Böylece feed
-- çalışmaya devam eder; hassas kolonlar (moderation_*, location_note,
-- address_visibility, province/district/neighborhood_id, deleted_at) anon'a kapanır.
-- =====================================================================

revoke select on public.listings from anon;

grant select (
  id, owner_id, title, slug, description, sales_pitch, share_templates, ad_assets,
  tags, price, commission_type, commission_value, category, location, status,
  partnership_mode, stock_count, min_partner_rating, commission_due_days,
  return_window_days, partner_rules, delivery_note, contact_method, created_at,
  currency, demo, bonus_amount, bonus_quota, featured
) on public.listings to anon;
