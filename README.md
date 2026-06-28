# ortaksat Mobil Uygulama

Expo React Native ile hazırlanan ortak satış mobil uygulaması. Hedef platformlar iOS App Store ve Google Play Store'dur.

## Çalıştırma

```bash
npm install
npm start
```

Expo Go ile QR kod okutulabilir. Android emülatör için:

```bash
npm run android
```

iOS Simulator için macOS gerekir:

```bash
npm run ios
```

## Kontrol

```bash
npm run typecheck
npx expo-doctor
npx expo export --platform android --output-dir dist-check-android
```

## Canlı Servisler

- Supabase URL ve publishable key `.env` içindedir.
- RLS politikaları migration dosyalarıyla yönetilir.
- İlan fotoğrafları `listing-images` bucket'ına yüklenir.
- Referral link: `https://ortaksat.com/i/urun-slug?ref=REFKOD`
- Destek, KVKK rızası, hesap silme talebi ve moderasyon kayıtları Supabase tablolarına yazılır.

## Mağaza Build Komutları

Önce EAS hesabı bağlanmalı:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

Internal test build:

```bash
npx eas-cli@latest build -p android --profile preview
```

Production build:

```bash
npm run build:android
npm run build:ios
```

Submit:

```bash
npm run submit:android
npm run submit:ios
```

## Yayın İçin Kalanlar

- `app.json` içindeki `extra.eas.projectId` değeri `eas init` sonrası gerçek project id ile değiştirilecek.
- MVP girişi e-posta/şifre ile devam edecek; SMS/telefon doğrulama sonraki güven fazında eklenecek.
- App Store Connect ve Google Play Console kayıtları açılacak.
- Gerçek mağaza ekran görüntüleri, nihai gizlilik politikası URL'si ve destek URL'si hazırlanacak.
