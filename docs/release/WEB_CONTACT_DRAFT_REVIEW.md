# Web iletişim ve başvuru taslağı — 27 Ekim 2026

Yerel değişiklikler; canlıya yayınlanmadı.

## Davranış

- Web ilan detayında mesaj tercihinde telefon sorgulanmaz ve numara gösterme alanı sunulmaz. Satıcı profilinin ayrıca yüklenmesi sohbetin ön koşulu değildir.
- İletişimden önce oturum, ilan uygunluğu ve kullanıcı engeli kontrol edilir. Geçerli davet bilgisi giriş dönüş yolunda korunur.
- Telefon/WhatsApp sorgusu tek işlem kilidi ve görünür devre dışı durumla korunur. RPC hatası yakalanır; kullanıcı tekrar deneyebilir. Numara yoksa veya dış uygulama açılamazsa mevcut uygulama içi mesaj yedeği kullanılır.
- Numara gösterme ağ hatası, giriş eksikliği veya paylaşılmış numara bulunmamasıyla karıştırılmaz.
- PrimaryButton isteğe bağlı disabled durumunu ve erişilebilirlik bilgisini destekler; bağlantı devre dışıyken gezinme oluşturmaz.
- Başvuru ilanı ve taslak birlikte hazırlanır. Geç gelen ilan, kayıtlı teklif türü/tutarını ezmez; form düzenleme başlamadan hazır olur. Aynı başvurudaki arka plan yenilemeleri formu tekrar başlatmaz. Eski taslak alanları tür ve uzunluk açısından kontrol edilir.

## Kontroller

- TypeScript geçti: `audit/web-review/contact-drafts-typescript.log`.
- Web dışa aktarımı geçti: `dist-check-mobile/contact-drafts-web`, `audit/web-review/contact-drafts-export.log`.
- Web iletişim testi 390/1440 pikselde geçti: `audit/web-review/web-contact-ui.json`. Mesaj tercihinde telefon sorgusu yok; eksik satıcı profiline rağmen sohbet; telefon hatası/yeniden deneme; işlem kilidi; doğru WhatsApp bağlantısı.
- Gecikmeli ilanla giriş dönüşü taslak testi: `scripts/check-application-draft-ui.mjs`, `audit/web-review/application-draft-ui.json`.
- Mobil iletişim/başvuru regresyon testi geçti: `audit/mobile-v4/listing-actions-ui.json`.

Tüm API yanıtları ve dış bağlantılar testlerde taklit edildi. Canlı mesaj/başvuru oluşturulmadı. Veritabanı değişmedi. Bu tur emülatör testi yapılmadı.
