# Domain Setup

`ortaksat.com` alan adı uygulama linkleri ve mağaza incelemesi için aşağıdaki dosyaları yayınlamalıdır.

## Android App Links

Yayınlanacak dosya:

`https://ortaksat.com/.well-known/assetlinks.json`

Yerel taslak:

`public/.well-known/assetlinks.json`

`REPLACE_WITH_EAS_OR_PLAY_APP_SIGNING_SHA256` değeri EAS/Google Play signing sertifikasının SHA-256 parmak iziyle değiştirilmeli.

## iOS Universal Links

Yayınlanacak dosya:

`https://ortaksat.com/.well-known/apple-app-site-association`

Yerel taslak:

`public/.well-known/apple-app-site-association`

`REPLACE_TEAM_ID.com.ortaksat.app` değeri Apple Developer Team ID ile güncellenmeli.

## Link Yapısı

Referral link:

`https://ortaksat.com/i/urun-slug?ref=REFKOD`

Mobil uygulamada route:

`app/i/[slug].tsx`
