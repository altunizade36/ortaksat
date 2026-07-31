# OrtakSat

**Ortak satış (partner-sales) pazaryeri.** Satıcılar ürün ilanı açar, komisyon belirler; ortaklar bu ürünleri kendi kanallarında tanıtır ve satış gerçekleşince komisyon kazanır. Tek kod tabanından **web + mobil-web + native** çalışır.

- 🌐 **Canlı:** [ortaksat.com](https://www.ortaksat.com) (web, Vercel + Supabase)
- 📱 **Mobil:** Expo/EAS ile iOS & Android (mağaza yayını hazırlık aşamasında)

> **Aracı platform modeli:** OrtakSat para tutmaz, komisyon kesmez, kargo/ödeme yapmaz. Ödeme ve teslimat taraflar arasındadır; platform yalnızca **doğrulanabilir yönlendirme + talep + komisyon takibi** sağlar.

---

## Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| İstemci | Expo SDK 54 · React 19 · React Native 0.81 · **React Native Web** |
| Yönlendirme | expo-router 6 (dosya-tabanlı) · web'de **statik export / SSG** |
| Backend | **Supabase** — Postgres · Auth · Storage · RLS · RPC (SECURITY DEFINER) |
| Web hosting | **Vercel** (master'a push → otomatik build & deploy) |
| E2E test | **Playwright** (canlı ortama karşı) |
| Dil | TypeScript · TR/EN çok dilli (i18n) |

## Proje yapısı

```
app/                 expo-router rotaları (ekranlar). (tabs)/ = ana sekmeler
components/          paylaşılan UI bileşenleri (ListingCard, ui.tsx, header…)
lib/                 servisler & yardımcılar (live-service, supabase, search, i18n…)
data/                app-store.tsx — istemci durum yönetimi (store)
supabase/migrations/ SQL migration'ları (şema + RLS + RPC; sürüm-versiyonlu)
scripts/             otomasyon (migration uygula, sitemap, OG, advisor, backfill…)
e2e/                 Playwright uçtan-uca testleri (canlıya karşı)
public/ assets/      statik varlıklar, ikonlar, maskot/logo
docs/ store/ types/  dökümantasyon, mağaza varlıkları, tip yardımcıları
```

---

## Kurulum & çalıştırma

```bash
npm install
cp .env.example .env       # değerleri kendi projene göre doldur (aşağıya bak)
npm start                  # Expo dev sunucusu (QR ile Expo Go / web)
```

Native geliştirme:

```bash
npm run android            # Android emülatör / cihaz
npm run ios                # iOS Simulator (macOS gerekir)
```

Web (statik export'u yerelde önizle):

```bash
npm run build:web          # dist-web/ üretir (OG map + sitemap + SEO enjeksiyonu dahil)
npm run serve:web          # dist-web'i http://localhost:8099 üzerinde sun
```

## Ortam değişkenleri

Gerçek değerler **`.env`** içindedir ve **git'e girmez** (`.gitignore`). Şablon için [`.env.example`](.env.example) dosyasına bak.

- `EXPO_PUBLIC_*` → uygulamaya gömülür (herkese açık): Supabase URL + publishable/anon key, Meta Pixel ID.
- Gizli değişkenler (`SUPABASE_MGMT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_TOKEN`, DB URL'leri, OAuth/DNS/Resend anahtarları) **yalnız yerel otomasyon scriptleri** içindir — uygulamaya **asla** gömülmez.
- E2E testleri ayrı bir **`.env.e2e`** (gitignored) kullanır: `E2E_BASE_URL`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON`, `E2E_SUPABASE_MGMT`, `E2E_PROJECT_REF`.

> 🔒 **Güvenlik:** Hiçbir gizli anahtar repoya girmez. Depoda yalnız placeholder içeren `.env.example` bulunur. Yeni bir sır eklerken `.env`'e yaz, `.env.example`'a yalnız **placeholder** ekle.

---

## Kalite & test

```bash
npm run typecheck          # tsc --noEmit (sıfır hata koşulu)
npm run quality            # encoding + eslint(hooks) + typecheck + expo-doctor
npx playwright test        # E2E (canlıya karşı; .env.e2e gerekir)
```

E2E testleri (`e2e/`) canlı ortama karşı çalışır: kayıt/giriş, ilan verme, favori, ortaklık, mesajlaşma, teklif, toplu yükleme (SKU upsert), satıcı/ortak panelleri, performans (LCP) ve mobil/masaüstü/tarayıcı (WebKit) pariteleri. Her test kendi verisini `e2e_` ön ekiyle oluşturur ve sonunda temizler; gerçek kullanıcı/ilan etkilenmez.

## Veritabanı (Supabase)

Şema, RLS politikaları ve RPC'ler **`supabase/migrations/`** içinde sürüm-versiyonlu SQL dosyalarıyla yönetilir.

```bash
npm run db:migrate           # tek migration uygula (Management API üzerinden)
npm run db:apply-all         # tüm bekleyen migration'ları uygula
npm run db:advisors          # Supabase güvenlik/performans advisor'larını tara
npm run backfill:thumbnails  # eksik kart-görsel varyantlarını üret (service_role gerekir)
```

- **RLS her tabloda açık.** Ayrıcalıklı işlemler `is_admin()` korumalı `SECURITY DEFINER` RPC'lerden geçer.
- Görseller `listing-images` Storage bucket'ına yüklenir; kart varyantı (`<uuid>-t.jpg`) yükleme anında üretilir.

---

## Dağıtım

### Web (Vercel)
`master` dalına push → Vercel otomatik build (`build:web`) + deploy. Statik export (SSG) + post-export SEO enjeksiyonu (title/description/canonical/OG, sitemap, IndexNow).

### Mobil (EAS)
```bash
npx eas-cli@latest login && npx eas-cli@latest init   # ilk kurulum
npm run build:internal     # dahili test build
npm run build:android      # / build:ios — production build
npm run submit:android     # / submit:ios — mağazaya gönder
```
Yayın öncesi kalanlar: `app.json` içindeki `extra.eas.projectId`, mağaza hesapları, cihaz testleri.

---

## Katkı & konvansiyonlar

- **Marka rengi turkuaz `#0EA5B7`** — `components/colors.ts` üzerinden token'lı; sabit-hex yasak.
- **Sahte veri yok.** Sayılar/istatistikler gerçek DB verisinden gelir.
- Tüm geliştirmeler **web + mobil-web + native + tablet** hepsinde tutarlı çalışmalı.
- Değişiklik öncesi `npm run typecheck` temiz olmalı; ilgili E2E ile doğrula.
