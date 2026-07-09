-- KRİTİK: profiles.successful_sales kolonu (20260709210000) PUBLIC_PROFILE_COLUMNS'a
-- eklendi ama anon rolüne SELECT izni verilmemişti. loadMarketplaceSnapshot profilleri
-- bu kolonla çekiyor; anon için sorgu "permission denied" (401) veriyor, Promise.all
-- hata → snapshot null → ÇIKIŞ YAPMIŞ ziyaretçide tüm pazaryeri feed'i BOŞ kalıyordu.
-- successful_sales hassas değil (kartta "N satış" olarak zaten herkese gösterilir).
grant select (successful_sales) on public.profiles to anon, authenticated;
