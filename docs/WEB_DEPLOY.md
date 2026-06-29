# Web Deploy (Vercel)

İlk sürüm **web**. Statik export (her route ayrı HTML, SEO dostu) Vercel'e yayınlanır.

## Tek seferlik kurulum

1. Vercel hesabı aç (vercel.com) ve domain `ortaksat.com`'u Vercel'e ekle.
2. CLI ile bağlan:

```bash
npm i -g vercel
vercel login
vercel link        # bu klasörü Vercel projesine bağla
```

`vercel.json` zaten hazır: build komutu `npm run build:web`, çıktı `dist-web`,
dinamik route'lar (`/i/:slug`, `/listing/:id`, `/store/:id`, `/chat/:id`,
`/listing-edit/:id`, `/explore-feed/:id`) için rewrite'lar tanımlı, `cleanUrls`
açık (uzantısız URL'ler).

## Yayınlama

```bash
npm run build:web          # dist-web üretir
vercel deploy --prod       # canlıya alır
```

veya GitHub'a push edip Vercel'in otomatik deploy'unu kullan (önerilen).
Push tabanlı kullanırken Vercel Project Settings'te:
- Build Command: `npm run build:web`
- Output Directory: `dist-web`
- Install Command: `npm install`

## Domain bağlama

Vercel panelinde `ortaksat.com` ve `www.ortaksat.com` ekle, DNS kayıtlarını
(A / CNAME) Vercel'in verdiği değerlerle güncelle.

## Yayın sonrası kontrol

- `https://ortaksat.com/` açılıyor mu, anasayfa SSR içeriği geliyor mu (sağ tık → kaynağı görüntüle, içerik dolu olmalı).
- `https://ortaksat.com/i/ornek-slug?ref=KOD` referral linki çalışıyor mu.
- `https://ortaksat.com/.well-known/assetlinks.json` ve `apple-app-site-association` erişilebilir mi (mobil app links için).
- OG önizleme: bir referral linkini WhatsApp/X'e yapıştır, kapak görseli (`/og-cover.png`) çıkıyor mu.

## Notlar

- `.well-known/assetlinks.json` içindeki SHA-256 ve `apple-app-site-association`
  içindeki Team ID, mobil uygulama imzaları belli olunca güncellenmeli (bkz.
  `docs/DOMAIN_SETUP.md`). Web yayını bunlar olmadan da çalışır; sadece mobil
  derin linkler için gerekir.
- Supabase Auth → URL Configuration'a redirect olarak `https://ortaksat.com/auth` ekle.
