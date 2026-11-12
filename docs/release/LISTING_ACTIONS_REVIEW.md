# İlan iletişimi ve başvuru kontrolü — 27 Ekim 2026

Bu çalışma yereldir; canlı siteye yayınlanmadı.

## Değişiklikler

- Mobil ilan detayında mesaj tercihli satıcı için telefon butonu gösterilmez. WhatsApp tercihi doğru kanalı açar. Telefon sorgusunda tekrar tıklama kilidi, hata bildirimi ve yeniden deneme vardır.
- Ortaklık butonlarının kullanılabilirliği ortak bir kuralla belirlenir: ilan sahibi, örnek ilan, engel, stok, ilan durumu ve davet koşulları değerlendirilir. Sunucunun mevcut yetkilendirmesi korunur.
- Bekleyen talep ve aktif ortaklık kendi detay kaydını açar; ilan kapansa veya ortak satışa kapatılsa da mevcut kayıt erişilebilir kalır.
- Geçerli davet bağlantısı ilan ve başvuru giriş yönlendirmelerinde korunur; sorgu değerleri kodlanır. Başvuru ekranındaki mesaj bağlantısı satıcı profil verisinin ayrıca yüklenmesine bağlı değildir.
- Başvuru tekrar gönderim kilidiyle korunur. Başarısız gönderimde metin ve teklif korunur. Başarılı sonuç gerçek kayıt kimliğini ve durumunu kullanır; yerel taslak temizleme hatası başarılı işlemi başarısız göstermez.
- Doğrudan açılan başvuruda yükleme hatası, bulunamayan ilandan ayrılır ve yeniden yükleme sunulur.

## Doğrulama

- `node scripts/check-listing-actions.mjs`: uygunluk kuralları ve davet bağlantılarının sorgu kodlaması geçti.
- `npx tsc --noEmit`: geçti (`audit/mobile-v4/listing-actions-typescript.log`).
- Son web dışa aktarımı: `dist-check-mobile/listing-actions-web-final`; derleme günlüğü `audit/web-review/listing-actions-export-final.log`.
- Üretim web çıktısında doğrudan başvuru yükleme kesintisi ve yeniden deneme: `audit/web-review/request-retry-ui.json`; form geri geldi, tarayıcı hatası yok.
- Mobil önizlemede sekiz ilan durumu, tercih edilen iletişim, telefon sorgusu kesintisi, komisyon doğrulaması, başarısız gönderimden sonra yeniden deneme ve doğru kayıt yönlendirmesi: `scripts/check-listing-actions-ui.mjs`.

Testlerde Supabase HTTP/WebSocket yanıtları ve dış bağlantılar taklit edildi; gerçek mesaj veya başvuru gönderilmedi, telefon/WhatsApp açılmadı. Veritabanı şeması değiştirilmedi. Mobil arayüz testi tarayıcıdaki geliştirme önizlemesidir; bu tur fiziksel cihaz/emülatör testi yapılmadı. Masaüstündeki ayrı iletişim işleyicisi bu kapsamda yeniden yazılmadı.
