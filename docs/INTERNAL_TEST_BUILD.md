# Internal Test Build

İlk internal build e-posta/şifre girişiyle test edilir. SMS sağlayıcısı sonraki güven fazına bırakılmıştır.

## Test Kapsamı

- E-posta ile kayıt, doğrulama linki, giriş ve şifre sıfırlama
- Supabase public listing, referral link ve RLS erişimi
- Ana sayfa ürün akışı ve Keşfet görsel/video grid
- Fotoğraf seçme izni ve gerçek ilan oluşturma
- İlan detayı, ortaklık başvurusu, başvuru onayı ve referans kodu
- Lead, satıcı paneli, ortak paneli, satış ve komisyon durumları
- Mesajlaşma, bildirimler, favoriler, yorumlar ve güven puanı
- Yasal/Destek merkezi, KVKK rızası ve hesap silme talebi
- Deep link route: `/i/[slug]?ref=...`

## Hazırlık

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest credentials
```

`app.json` içindeki `extra.eas.projectId` gerçek EAS project id ile güncellenir.

Supabase Auth ayarlarında redirect URL olarak şu değerler eklenmelidir:

```text
ortaksat://auth
https://ortaksat.com/auth
```

## Android Internal APK

```bash
npm run build:android:preview
```

## iOS Internal / TestFlight Öncesi

```bash
npm run build:ios:preview
```

## Üretim AAB

```bash
npm run build:android
```

## Notlar

- `public/.well-known/assetlinks.json` içindeki SHA-256 değeri Play App Signing veya EAS credential sonrasında güncellenmelidir.
- `public/.well-known/apple-app-site-association` içindeki Apple Team ID güncellenmelidir.
- SMS OTP testi bu build kapsamında yoktur; e-posta auth MVP kapsamıdır.
