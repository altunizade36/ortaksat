# Deployment kaydı — 5 Kasım 2026

- Güncel web önizlemesi: https://ortaksat-db3u3vr1l-fatih5.vercel.app
- Deployment: `dpl_HFquqmkPADpCRczF6Mhqh443vQ6i`, durum `READY`, ortam Preview.
- Proje: `ortaksat` / `prj_jfXjc5NkBfaNOJaUXmUE4O09fKep`; ekip: `fatih5`.
- `preview-nov5.log` ve `preview-checks.json`: 320/390/1440 ölçüleri, doğru desktop/mobile navigasyon, altı rota HTTP 200, sayfa istisnası yok. Testte Supabase yazıları engellendi.
- Önizleme Vercel Authentication ile korunuyor. Kullanıcı incelemesi için 23 saatlik geçici paylaşım bağlantısı oluşturuldu; süresiz bypass veya proje korumasını kapatma yapılmadı. Paylaşım anahtarı bu belgeye kaydedilmez.
- Trust migration'ları ve Edge Functions canlı backend'e uygulanmadı; özellik kapalı. Bu adres gerçek Trust backend staging ortamı değildir.
- Kullanıcının “Evet, bu web sürümünü canlıya al” onayının ardından mobil web düzenlemelerini içeren `dpl_9z38RF3ZJqMXk2VzG8i2ao4kgKkp` 5 Kasım 2026'da `https://www.ortaksat.com` alan adına promote edildi. Önceki `dpl_7UxnrWCKY6VwtNyhDVbfGXtevmC2` geri dönüş sürümüdür. [Mobil web yayın kaydı](../MOBILE_WEB_2026-11-05.md).
- Onay web arayüzü içindir. Trust migration'ları uygulanmadı; servis entegrasyonu tamamlanmadan canlı feature flag açılmaz.

Android emülatörü `OrtakSat_Mobile_API35` üzerinde Expo Go 54.0.8 ile uygulama açıldı. Güven Karnesi kapalı sistem görünümü, özel işlem merkezinin giriş kontrolü ve geri dönüş doğrulandı (`native-checks-nov5.json`, `native-profile-nov5.png`). Gerçek kullanıcı işlemi yazılmadı. Yerel native tam Trust satış/ödeme akışı, aktif test Supabase backend olmadan doğrulanmış sayılmaz.

EAS oturumu açılmadı; kullanıcının tercihiyle yerel test sürdürüldü. Mağaza veya APK/IPA yayını yok. Metro yerel geliştirme için 8088 portunda çalıştırıldı; emülatör ekranı kullanıcı incelemesine bırakıldı.
