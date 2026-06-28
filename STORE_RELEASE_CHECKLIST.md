# Store Release Checklist

## Hazır

- Expo Router tablı mobil uygulama yapısı
- iOS bundle identifier: `com.ortaksat.app`
- Android package: `com.ortaksat.app`
- Deep link scheme: `ortaksat://`
- Universal/App Links alan adı: `https://ortaksat.com/i/...`
- Supabase Auth, RLS, Storage, referral lead, destek ve moderasyon tabloları
- EAS build profilleri: development, preview, production
- Android App Bundle production ayarı
- Uygulama içi gizlilik/KVKK özeti, destek talebi ve hesap silme talebi ekranı

## Yapılacak

- MVP e-posta/şifre girişini, test kullanıcılarını ve şifre politikasını doğrula; SMS sağlayıcısını sonraki güven fazına bırak.
- Apple Developer hesabında App ID oluştur.
- App Store Connect'te uygulama kaydı oluştur.
- Google Play Console'da uygulama kaydı oluştur.
- Android service account JSON dosyasını yerelde güvenli şekilde hazırla, repoya koyma.
- `eas credentials` ile iOS sertifika/provisioning ve Android keystore yönetimini tamamla.
- Gizlilik politikası ve kullanım şartları için nihai hukuk metinlerini webde yayınla.
- Mağaza açıklaması, kısa açıklama, kategori ve ekran görüntülerini hazırla.
- Domain doğrulama dosyalarında Android SHA-256 ve Apple Team ID değerlerini güncelle.
- İlk Android yüklemeyi internal testing kanalına yap.
- İlk iOS yüklemeyi TestFlight'a yap.
