# Kayıt ve ilan verme dayanıklılığı — 29 Ekim 2026

29 Ekim 2026'da `dpl_5T32Q9BfU4oiVYRnAXEoRu4BBoTK` ile canlıya yayınlandı. Yayın ve canlı kontrol ayrıntıları: `RESPONSIVE_AUTH_REVIEW.md`.

## Kayıt / doğrulama

- Kayıt, giriş, Google ve şifre sıfırlama istekleri React state güncellemesini beklemeyen ortak bir işlem kilidi kullanır. Hızlı tekrarlı gönderim aynı formdan paralel istek başlatmaz; finally kilidi açar.
- Masaüstü giriş/kayıt düğmelerinin işlem sürerken disabled/busy durumları erişilebilir biçimde bildirilir.
- Altı hane tamamlanmadan e-posta doğrulaması gönderilmez; satır içi açıklama gösterilir.
- Doğrulama ile kod yeniden gönderme aynı işlem kilidini paylaşır. İşlem sırasında kod alanı ve vazgeçme işlemi kilitlidir.
- Yeniden gönderme hatası görünür; yazılan kod silinmez. Başarılı gönderimden sonra saat farkına göre hesaplanan 60 saniyelik bekleme gösterilir.
- Hatalı doğrulama kodu korunur ve yeniden denenebilir. Başarıdan sonra başlangıçtaki `/create` hedefi korunur.
- Başarılı kayıt sonrası şifre alanları bellekteki form durumundan temizlenir.
- Doğrulamadan giriş yapılabileceğini söyleyen yanıltıcı yardımcı metin kaldırıldı; spam klasörü ve en son kodu kullanma yönlendirmesi var.

## İlan verme

- Ortak web/mobil yayın handler'ında eşzamanlı işlem kilidi var; galeri/kamera seçicisi açıkken yayın başlatılmaz.
- Giriş yapmamış kullanıcının taslağı cihazına kaydedilemezse form korunur, hata gösterilir ve kayıt sayfasına geçilmez. Yeniden denemede önce taslak kaydedilir, sonra kayıt ekranına geçilir.
- Başarı sonrası yerel taslak temizleme hatası yakalanır; oluşturulmuş ilan için yeniden yayınlama hatası gösterilmez.
- Yayın ve taslak düğmelerine açık erişilebilir ad ve işlem durumu eklendi.
- Fotoğraf sınırı kapak dahil 5 olarak korundu; video eklenmedi.

## Doğrulama

- `scripts/check-web-signup-recovery-ui.mjs`: 1440 px kayıt, çift gönderimde tek istek, eksik kodun yerelde reddi, yeniden gönderme hatası/tekrar deneme, işlem kilitleri, bekleme, hatalı kodun korunması, 390 px taşma kontrolü ve başarı sonrası `/create` dönüşü geçti.
- `scripts/check-web-create-storage-ui.mjs`: gerçek kategori şemasıyla oluşturulan örnek taslak geri yüklendi; depolama hatasında aynı formda kalma, değerlerin korunması, hızlı çift tıklamada tek kayıt denemesi ve başarıyla kaydedilince kayıt sayfasına geçme geçti. İlan yazma sayısı sıfır.
- TypeScript, hedefli ESLint, Türkçe karakter ve diff kontrolleri temiz.
- Web export: `dist-check-mobile/account-listing-web` başarılı. Android export: `dist-check-mobile/account-listing-android` başarılı; sonradan yalnız yardımcı metin güncellendi, native emülatör akışı bu turda çalıştırılmadı.
- Görsel kanıt: `audit/web-review/signup-code-recovery-390.png` (yerel örnek veri).

API yanıtları testlerde taklit edilmiştir. Gerçek hesap açılmadı, doğrulama e-postası gönderilmedi, fotoğraf yüklenmedi ve ilan yayınlanmadı. Veritabanı, SDK veya sunucu doğrulama/rate-limit ayarları değişmedi. Ön uç kilidi sunucu tarafında kalıcı idempotency garantisi değildir. Tüm kayıt/ilan akışlarının eksiksiz bitirildiği iddia edilmez.
