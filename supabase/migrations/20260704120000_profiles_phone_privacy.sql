-- =====================================================================
-- Profil telefon gizliliği — PII sızıntısı kapatma
-- =====================================================================
-- SORUN: public.profiles tablosu anonim (anon) role'e tüm kolonlarıyla
-- SELECT açık. Bu, herhangi birinin anon anahtarla /rest/v1/profiles?select=phone
-- çağırıp TÜM kullanıcıların telefon numaralarını kazımasına izin verir.
-- Şu an yalnızca test hesapları var; gerçek kullanıcılar telefon ekleyince
-- doğrudan PII sızıntısı olur.
--
-- ÇÖZÜM: anon role'den `phone` (ve `preferences`) kolonlarını geri al.
-- Diğer kolonlar (isim, avatar, puan, rozetler) herkese açık kalır — satıcı
-- kartları/ilan detayında görünmeye devam eder. `phone`'a yalnızca giriş yapmış
-- (authenticated) kullanıcılar erişir; iletişim açığa çıkarma akışı zaten
-- girişe + ortaklık/yetkiye bağlı.
--
-- ⚠️ UYGULAMA TAKİBİ (bu migration'la BİRLİKTE gitmeli):
--   Anon tarafında profiles'ı `select("*")` ile çeken yerler `phone` geri
--   alındığında hata verir. Şu 4 çağrı açık kolon listesine çevrilmeli
--   (lib/supabase-data.ts): fetchListingById, loadMarketplaceSnapshot,
--   loadMarketplacePage, searchListings. İletişim açığa çıkarma handler'ı
--   (app/listing/[id].tsx) telefonu yalnızca girişli+yetkili kullanıcı için
--   ayrı ve dar bir sorguyla çekmeli.
-- =====================================================================

-- Kolon bazlı yetki (RLS kolon gizleyemez; GRANT/REVOKE kolon destekler).
revoke select (phone)       on public.profiles from anon;
revoke select (preferences) on public.profiles from anon;

-- Giriş yapmış kullanıcılar için telefon erişimi net olsun (idempotent).
grant  select (phone)       on public.profiles to authenticated;

-- Not: authenticated bir kullanıcı yine de yalnızca RLS'in izin verdiği
-- satırları görür; kolon grant'i satır görünürlüğünü değiştirmez.
