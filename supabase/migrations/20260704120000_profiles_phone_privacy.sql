-- =====================================================================
-- Profil telefon gizliliği — anonim PII sızıntısını kapatma
-- =====================================================================
-- SORUN: public.profiles tablosu anonim (anon) role'e tüm kolonlarıyla
-- SELECT açıktı. Herhangi biri anon anahtarla
--   /rest/v1/profiles?select=phone
-- çağırıp TÜM kullanıcıların telefon numaralarını kazıyabiliyordu. Gerçek
-- kullanıcılar telefon ekledikçe doğrudan PII sızıntısı olurdu.
--
-- ÇÖZÜM: anon role'den `phone` ve `preferences` kolon SELECT yetkisini geri al.
-- Diğer kolonlar (isim, avatar, puan, rozetler) herkese açık kalır — satıcı
-- kartları/ilan detayında görünmeye devam eder. `phone`'a yalnızca giriş yapmış
-- (authenticated) kullanıcılar, iletişim/arama anında erişir.
--
-- UYGULAMA TARAFI (bu migration ile birlikte deploy edildi):
--   - lib/supabase-data.ts: tüm anon-yüzlü profil okumaları PUBLIC_PROFILE_COLUMNS
--     ile açık kolon listesine çevrildi (phone/preferences hariç). `select("*")`
--     kalmadı → anon revoke sonrası hata oluşmaz.
--   - fetchSellerPhone(ownerId): telefonu yalnızca iletişim anında ayrı, dar bir
--     sorguyla çeker (girişli kullanıcı gerçek numarayı alır, anon boş alır).
--   - app/listing/[id].tsx handleContact ve app/(tabs)/messages.tsx "ara" butonu
--     bu yardımcıyı kullanır.
-- =====================================================================

-- RLS kolon gizleyemez; kolon bazlı GRANT/REVOKE bunu yapar (idempotent).
revoke select (phone)       on public.profiles from anon;
revoke select (preferences) on public.profiles from anon;

-- Giriş yapmış kullanıcılar için telefon erişimi net kalsın (kendi profili +
-- iletişim kurduğu satıcı). RLS satır görünürlüğü ayrıca geçerlidir.
grant  select (phone)       on public.profiles to authenticated;
