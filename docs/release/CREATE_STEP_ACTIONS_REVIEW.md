# Mobil ilan verme: devam alanı ve klavye — 28 Ekim 2026

Yerel çalışma; canlıya yayınlanmadı.

## Değişiklikler

- İlan verme formuna sabit alt işlem alanı eklendi: mevcut adım bilgisi, adıma uygun devam düğmesi ve önceki adım. Üst adım kısayolları ve Android geri davranışı korunur. Form serbestçe kaydırılabilir; ayrı ve kapalı sayfalara dönüştürülmedi.
- Fotoğraf adımında fotoğraf eksikliği, ürün adımında kategori/başlık/zorunlu alan ve konum, önizleme öncesinde bütün koşullar kontrol edilir. Hata ilgili bölüme kaydırır. Başlık hatasında alan işaretlenir ve odaklanır.
- Android klavyesi için bu akışa özel KeyboardAvoidingView height davranışı eklendi. Diğer ekranların varsayılan davranışı değişmedi. Klavye açılınca üst adım şeridi ve mevcut alt gezinme gizlenerek yer açılır; devam alanı güvenli alt boşlukla korunur.
- Odaktaki alan native içerik ref'i üzerinden ölçülerek formun görünür kısmına kaydırılır. Sayısal native handle yerine Fabric ile uyumlu ref kullanılır.
- Beş fotoğraf sınırı, kapak yapma ve kaldırma, taslak koruma ve son yayınlama onayı korunur; video eklenmedi.

## Doğrulama

- `scripts/check-create-step-actions-ui.mjs`: 320/390 pikselde sabit devam alanı, fotoğraf/kategori engelleri, önceki adım, beş fotoğraflı taslak ve kapak değiştirme; yayınlama yapılmadan geçti. Kanıt: `audit/mobile-v4/create-step-actions-ui.json`.
- Emülatör: OrtakSat_Mobile_API35 / Expo Go üzerinde normal Gboard açıkken başlık ve devam düğmesi görünür. XML: başlık y=391–517, devam y=1331–1454; hata katmanı yok. Kanıt: `audit/mobile-v4/create-keyboard-actions-native-final.png`, XML ve JSON. Test sırasında değiştirilen emülatör el yazısı klavyesi ayarı başlangıç değerine geri döndürüldü.
- Mevcut gerçek taslak geri yüklenmedi veya silinmedi; emülatörde metin girilmedi. Gerçek ilan yayınlanmadı veya mesaj gönderilmedi.
- TypeScript ve değiştirilen bileşenlerde ESLint günlükleri: `audit/mobile-v4/create-step-actions-typescript.log`, `audit/mobile-v4/create-step-actions-eslint.log`.
- Bu formda önceki düğmesi ve başlıktaki Geri ile adım dönüşü hedefli testte kontrol edildi. Eski genel gezinme testi, eski statik HTML ile güncel Metro kodunun hidrasyon uyuşmazlığı nedeniyle tamamlanamadı: `audit/mobile-v4/back-navigation-ui.log`; bu nedenle genel gezinmenin tamamı için yeni bir başarı iddiası yok.
- Son Android çıktısı: `dist-check-mobile/create-step-actions-android-final`; günlük `audit/mobile-v4/create-step-actions-android-export-final.log`.

Tarayıcı testlerinde API yanıtları taklit edildi. iOS fiziksel cihaz testi bu tur yapılmadı; ayrı bir doğrulama ihtiyacı olarak kalıyor.
