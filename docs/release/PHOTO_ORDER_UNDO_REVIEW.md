# Mobil fotoğraf sırası ve geri alma — 28 Ekim 2026

Yerel değişiklikler; canlıya yayınlanmadı.

## Davranış

- İlan oluşturma fotoğraf penceresinde Öne taşı / Arkaya taşı kontrolleri eklendi. Seçili fotoğrafın kimliği korunur; ilk fotoğraf kapaktır. Sıra başında/sonunda uygun yön kapalıdır.
- Oluşturmada son kaldırılan fotoğraf Geri al ile eski konumuna geri konur. Kaldırılan kapak geri alındığında yeniden kapaktır. Fotoğraf sayısı beşi aşamaz ve aynı URI ikinci kez eklenmez.
- Düzenleme ekranında küçük görsellerin altında sıra değiştirme okları, daha büyük kapak hedefi ve son kaldırmayı geri alma vardır. Kaydetme/fotoğraf alma sürerken bu işlemler kilitlidir.
- Fotoğraf penceresinde dışarıdan azalan fotoğraf sayısı seçili indeksi geçersiz bırakmaz; boş dizide döngüsel gezinme sıfıra bölünmez.
- Son kaldırma için tek geri alma kaydı tutulur; tam bir işlem geçmişi değildir. Fotoğraf limiti beş olarak korundu, video eklenmedi.

## Kontroller

- `scripts/check-photo-order.mjs`: sıra hareketi, sınırlar, eski kapak konumunu geri yükleme, kopya engeli, beş fotoğraf limiti, giriş dizisinin değişmemesi geçti.
- Oluşturma/taslak testi genişletildi: kapak seçimi, öne/arkaya taşıma, kaldırma/geri alma, otomatik taslakta ilk fotoğraf ve beş fotoğrafın korunması. Kanıt: `audit/mobile-v4/create-step-actions-ui.json`.
- `scripts/check-editor-photo-order-ui.mjs`: farklı gerçek örnek görsellerle sıra/kapak kimliği, kaldırma/geri alma ve sınır düğmeleri kontrol edildi. Sunucuya kaydetme yapılmadı. Kanıt: `audit/mobile-v4/editor-photo-order-ui.json`.
- TypeScript ve hedefli ESLint: `audit/mobile-v4/photo-order-typescript.log`, `audit/mobile-v4/photo-order-eslint.log`.
- Android çıktısı: `dist-check-mobile/photo-order-android`; günlük `audit/mobile-v4/photo-order-android-export.log`.

Arayüz testleri mobil geliştirme önizlemesinde ve taklit API verileriyle yapıldı. Bu tur gerçek cihaz/emülatör fotoğraf yüklemesi veya gerçek ilan değişikliği yapılmadı. Veritabanı şeması değiştirilmedi.
