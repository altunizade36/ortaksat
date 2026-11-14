-- Mağaza sayfasındaki kategori çipleri GİRİŞSİZ ziyaretçide yüklenmiyordu.
--
-- mobile_seller_categories çağıranın izinleriyle çalışıyor ve public.listings tablosunu doğrudan okuyordu;
-- anonim rolün o tabloda doğrudan okuma izni yok (yalnız listing_public_cards görünümü üzerinden) → 401.
-- Uygulamada misafir, mağazada "Tümü (0)" ve "Kategorileri Yenile" düğmesi görüyordu (2026-11-14).
--
-- İşlev yalnız YAYINDAKİ ilanların kategori adlarını ve sayılarını döndürür (herkese açık bilgi; mağaza
-- sayfasındaki ilan listesinden zaten görülebilir) → tanımlayanın izinleriyle çalıştırmak güvenlidir.
alter function public.mobile_seller_categories(uuid) security definer;
revoke all on function public.mobile_seller_categories(uuid) from public;
grant execute on function public.mobile_seller_categories(uuid) to anon, authenticated;
