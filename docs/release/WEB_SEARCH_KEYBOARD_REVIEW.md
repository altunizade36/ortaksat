# Web arama kutusu incelemesi — 28 Ekim 2026

28 Ekim 2026 tarihinde `dpl_BBk7w15aGsL9DAFFeQL1sYe8ARGp` ile canlı siteye yayınlandı. Ayrıntılar: `WEB_DEPLOY_2026_10_28.md`. Veritabanı veya ilan verisi değiştirilmedi.

## Değişiklikler

- Arama önerilerinde yukarı/aşağı tuşlarıyla seçim, Enter ile seçilen ilanı/aramayı açma, Escape ile kapatma.
- Combobox/listbox bağlantıları, aktif önerinin erişilebilir kimliği ve görünür seçim vurgusu.
- Öneri listesinin 440 px içinde kayması; klavyeyle seçilen satırın görünür tutulması.
- Eşleşen yerel öneri olmadığında bunun açıkça belirtilmesi ve tüm ilanlarda arama seçeneğinin korunması. Bu durum sunucuda hiç sonuç olmadığı iddiasını taşımaz.
- Kayıtlı arama kaldırma düğmesi arama tıklamasından ayrıldı; kaldırma sayfa açmaz ve alan odağını korur.
- Sorgu 120 karakterle sınırlandı, gönderimde çoklu boşluklar birleştirildi.
- Eski geçmiş kayıtları okunurken geçersiz/boş değerler elenir, Türkçe harf duyarlı tekrarlar kaldırılır ve en fazla 8 kayıt gösterilir.
- Dar ekranda uzun kategori yolu asıl kategori adını sıkıştırmaz.

## Kontroller

- `scripts/check-web-search-keyboard-ui.mjs`: 1440 px klavye akışı, geçmiş temizliği/kaldırma, Enter ile ilan açma, normal sorgu gönderimi, boş öneri durumu, karakter sınırı ve 390 px taşma kontrolü geçti.
- `scripts/check-web-recovery-ui.mjs`: ilk arama hatası/yeniden deneme, sayfalama hatasında mevcut satırların korunması, eski sorgu yanıtının yalıtılması, favori hata/kurtarma, 301 favorinin parçalı yüklenmesi ve 320 px kontrolü geçti.
- TypeScript ve hedefli ESLint geçti.
- Expo web export: `dist-check-mobile/search-keyboard-web` başarılı.
- Görsel kontrol: `audit/web-review/search-keyboard-390.png`.

Tarayıcı testleri yalnızca yerel örnek verilerle ve taklit API yanıtlarıyla yapıldı. Gerçek kullanıcı işlemleri veya canlı veritabanı yazmaları yapılmadı. Ekran okuyucu cihazıyla manuel test bu kapsamda yapılmadı. Uygulamanın tüm ekranlarının tamamlandığı anlamına gelmez.
