# Klasör Yapısı — İyileştirme Önerileri (opt-in, düşük risk)

> Bu bir **plan**dır; otomatik uygulanmadı. Her madde import yolu değişikliği içerir → toplu
> yapılmamalı, kademeli + her adımda `npm run build:web` + görsel regresyon doğrulamasıyla.
> **Dokunulmayacaklar:** app router, Expo, Supabase, navigation, state, backend, dosya isimleri.

## Mevcut durum (gerçek repo — GitHub'da izli)
Repo **zaten temiz**. `git ls-files` ile doğrulandı:
- **Root'ta yalnız 14 meşru izli dosya:** `.env.example`, `.gitignore`, `README.md`,
  `PRODUCT_LOGIC.md`, `STORE_RELEASE_CHECKLIST.md`, `SUPABASE-SETUP.md`, `app.json`,
  `eas.json`, `middleware.ts`, `package.json`, `package-lock.json`, `playwright.config.ts`,
  `tsconfig.json`, `vercel.json`.
- **Build çıktıları + scratch + demo + log + audit ZATEN `.gitignore`'da** (repoda yok):
  `dist/`, `dist-web/`, `dist-check-android/`, `dist-demo-check/`, `demo-check.*`,
  `scratch_q*.mjs`, `_*.mjs`, `audit/`, `_web-audit*`.
- **`docs/` zaten var** (DOMAIN_SETUP, INTERNAL_TEST_BUILD, WEB_DEPLOY, buyume-seed-*, store-listing).

→ **Madde 1, 2, 3 (scratch/dist/demo/log) fiilen çözülmüş.** Yerel diskte görünen kalabalık
gitignore'lu artefakt; gerçek projeye/CI'a girmiyor. İstenirse yerel temizlik yapılabilir
(dist yeniden üretilir; scratch dev-only).

## Kullanılmayan dosya taraması — SONUÇ: öksüz dosya YOK
İlk tarama `app/ components/ lib/ scripts/` kapsamındaydı ve `data/` klasörünü atlamıştı;
bu yüzden birkaç dosya yanlışlıkla "öksüz" göründü. `data/app-store.tsx` kontrolüyle düzeltildi:
- `lib/audit.ts` — **KULLANILIYOR**: `logActivity` → sign_in/sign_up/sign_out/listing_create
  (admin panelinin okuduğu `activity_logs`'a yazan aktif taraf).
- `lib/auth-links.ts` — **KULLANILIYOR**: `subscribeToAuthUrls`/`getInitialAuthUrl`/
  `handleSupabaseAuthUrl` → deep-link auth, app-store'da bağlı.
- `lib/mascot-source.native.ts` — **KULLANILIYOR** (platform çifti).

→ Silinecek ölü kod yok. (Ders: kullanım taramasında `data/` dahil TÜM kaynak klasörleri tara.)

## Önerilen hedef yapı (kademeli)
Her taşıma = `git mv` + import yollarını güncelle + build + görsel regresyon. Barrel dosyası
(`index.ts` re-export) ile import yollarını değiştirmeden kademeli geçiş de mümkün.

```
components/
  ui/          # PrimaryButton, Chip, SegButton, StatChip, EmptyState, StatusPill…
  cards/       # ListingCard, HomeCard, PartnerCard
  forms/       # DeskField, create-flow alanları
  layout/      # web-container, web-landing, footer
  feedback/    # error-boundary, skeleton, toast
  navigation/  # tab bar, header
  brand/       # Mascot, logo (zaten kısmen var)
  shared/      # SafeRemoteImage, ImageWatermark

types/         # (ayrı klasör YOK — şu an lib/types.ts; bölünürse) api/ database/ listing/ profile/ shared/ ui/
lib/
  api/ auth/ hooks/ utils/ constants/ validators/ analytics/
store/         # (varsa) auth/ listings/ chat/ profile/ ui/
docs/
  architecture/ deployment/ database/ ui/ product/ release/
audit/         # (gitignore'dan çıkarılıp curate edilirse) accessibility/ ui/ ux/ performance/ regression/ releases/
```

## Güvenli uygulama sırası
1. ✅ **YAPILDI — `docs/` alt-klasörleri** (deployment/growth/release/product/database/architecture).
   Root'tan `PRODUCT_LOGIC.md`, `STORE_RELEASE_CHECKLIST.md`, `SUPABASE-SETUP.md` docs'a taşındı
   (root artık yalnız `README.md`). `scripts/check-encoding.mjs` güncellendi (`walk("docs")` kapsıyor).
   Encoding kontrolü temiz, iç-linkler geçerli. Kod import etmez → sıfır regresyon.
2. `components/` alt-klasörleri **barrel (`components/ui/index.ts`) ile** → import yolları
   `@/components/ui` olarak sabit kalır, dosyalar taşınır.
3. `lib/` alt-klasörleri en son (en çok import edilen → en yüksek dikkat).
4. `types/`/`store/` yalnız gerçekten büyürse.

**Kural:** tek seferde bir klasör, her adımda build + görsel regresyon; regresyonda geri al.
