# İlan listesi devam yükleme ve filtre geçişleri — 27 Ekim 2026

Yerel değişiklikler; yayınlanmadı.

## Düzeltmeler

- Sunucu sayfalama konumu, gösterilen tekil kart sayısından ayrıldı. Sayfalarda aynı ilan tekrar gelirse kart çoğalmaz; sonraki istek sunucudan tüketilen satır sayısına göre ilerler.
- Devam yükleme tek işlem kilidiyle korunur. Hata halinde mevcut ilanlar korunur ve aynı sayfa yeniden denenir.
- Boş yanıt geldiğinde, sunucu toplamı henüz güncellenmemiş olsa bile devam düğmesi kaldırılır. Arama/filtre değişiminden sonra geciken eski sayfa yeni sonuçlara eklenmez.
- Alt kategoriye geçerken ortak fiyat, konum, para birimi, arama ve sıralama korunur. Farklı kategorinin özellikleri temizlenir. Aynı kategoriyi tekrar seçmek mevcut özellikleri temizlemez.
- Fiyat çipinde USD/EUR seçimine rağmen TL yazılması düzeltildi. Fiyat alanlarının yer tutucuları seçilen para birimini kullanır; para birimi seçilmediğinde TL varsayımı yapılmaz. Slider üst sınırı için başka para birimindeki ilan fiyatları kullanılmaz.
- İlk yükleme hatasında sonuç başlığı 0 ilan yerine yükleme hatasını gösterir.

## Doğrulama

- `scripts/check-catalogue-pagination-ui.mjs`: çakışan sayfalar, ağ hatasından sonra yeniden deneme, işlem kilidi, boş sayfa ve devam yüklemesi sırasında değişen arama testi geçti. Kanıt: `audit/mobile-v4/catalogue-pagination-ui.json`.
- Arama/filtre regresyonu (320 ve 390 piksel dahil): `audit/mobile-v4/search-filter-ui.json`.
- Kaydedilmiş arama/galeri testi genişletildi: EUR fiyat etiketi, EUR alan yer tutucusu ve alt kategoriye geçerken fiyat/konum/para birimi/sıralamanın korunması. Kanıt: `audit/mobile-v4/saved-gallery-ui.json`.
- TypeScript: `audit/mobile-v4/catalogue-recovery-typescript.log`.
- Son Android dışa aktarımı: `dist-check-mobile/catalogue-android-final`; `audit/mobile-v4/catalogue-android-export-final.log`.

Arayüz testleri mobil geliştirme önizlemesinde, taklit API yanıtlarıyla yapıldı. Veritabanı şeması değiştirilmedi. Android dışa aktarımı cihazda/emülatörde çalıştırma testi değildir.
