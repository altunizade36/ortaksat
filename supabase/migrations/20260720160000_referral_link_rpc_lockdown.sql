-- ---------------------------------------------------------------------------
-- GÜVENLİK: referral_public_links anon-blanket-SELECT enumerasyonunu kapat.
-- SORUN: tablo anon'a SELECT (using(true)) açıktı → saldırgan slug/ref_code OLMADAN
-- REST'ten tüm satırları döküp TÜM ortakların gerçek ad-soyadı + platform-geneli toplam
-- satış hacmi + satıcı puanı dizinini çıkarabiliyordu (BI/PII sızıntısı). Ayrıca anon'da
-- gereksiz INSERT/UPDATE/DELETE/TRUNCATE grant'ları vardı (RLS write-policy yok → yazımlar
-- zaten bloklu ama hijyen kötü).
-- ÇÖZÜM: (slug, ref_code) çiftini SUNUCUDA zorlayan SECURITY DEFINER RPC → tek satır döner.
-- Tabloya blanket anon/authenticated erişimi tamamen kaldırılır (populate eden private
-- SECURITY DEFINER fonksiyon owner olarak çalışır, grant'a bağlı değil).
-- ---------------------------------------------------------------------------

create or replace function public.resolve_referral_link(p_slug text, p_ref_code text)
returns table(
  ref_code text, partnership_id uuid, listing_id uuid, slug text, title text, price numeric,
  commission_type text, commission_value numeric, category text, location text, image_url text,
  agreed_attribution_window_days int,
  partner_name text, partner_verified boolean, partner_sales int, seller_rating numeric, seller_verified boolean
)
language sql stable security definer set search_path to 'public'
as $$
  select r.ref_code, r.partnership_id, r.listing_id, r.slug, r.title, r.price,
         r.commission_type, r.commission_value, r.category, r.location, r.image_url,
         r.agreed_attribution_window_days,
         r.partner_name, r.partner_verified, r.partner_sales, r.seller_rating, r.seller_verified
  from public.referral_public_links r
  where r.slug = p_slug and r.ref_code = p_ref_code
  limit 1;
$$;

grant execute on function public.resolve_referral_link(text, text) to anon, authenticated;

-- Blanket tablo erişimini kaldır: artık yalnız RPC ile (slug+ref_code) tek satır çözülür.
drop policy if exists "referral public links readable" on public.referral_public_links;
revoke all on public.referral_public_links from anon, authenticated;
