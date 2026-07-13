-- KRİTİK: platform_settings.review_before_publish CANLIDA "true" idi.
--
-- Etkisi: her yeni ilan pending_review'a düşüyor, aktif bir moderasyon ekibi olmadığı için
-- ASLA yayınlanmıyordu → satıcı "İlanı Yayınla"ya basıyor, panelde "Aktif ilan: 0" görüyor,
-- ilan hiçbir yerde görünmüyordu. Platformda hiç GERÇEK (demo olmayan) ilan olmamasının
-- sebebi buydu.
--
-- Ürün kararı (moderation-off): ilanlar ANINDA yayınlanır; yasaklı içerik yine kelime
-- taraması (scan_prohibited / scanTextLocal) ile engellenir, kategori-oto-inceleme listesi
-- boştur (REVIEW_CATEGORIES = []). Manuel moderasyon istenirse admin panelinden açılır.
update public.platform_settings
   set review_before_publish = false,
       updated_at = now()
 where id = 1;
