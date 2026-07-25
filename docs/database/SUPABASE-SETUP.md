# OrtakSat — Canlı Supabase kurulumu

## 0) Güvenlik (önce bunu yap)
- **Secret key sızdıysa hemen yenile:** Dashboard → Settings → API Keys → Secret keys → Roll/Revoke.
- Secret key **asla** repoya/`.env`'in `EXPO_PUBLIC_*` değişkenlerine girmez. Sadece publishable key istemcide kullanılır.
- `.env` zaten `.gitignore`'da; commit edilmez.

## 1) İstemci anahtarları (zaten ayarlı)
`.env` (yerel) ve Vercel ortam değişkenleri:
```
EXPO_PUBLIC_SUPABASE_URL=https://akyzzdwbzgsnhdircuce.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```
> Bunlar istemci-güvenlidir (zaten tarayıcı paketinde görünür). RLS verileri korur.

## 2) Şema + politikalar + il/ilçe (EN KOLAY YOL — CLI gerekmez)
Dashboard → **SQL Editor** → **New query** → `supabase/setup-all.sql` dosyasının
tamamını yapıştır → **Run**. Bu tek dosya şunları kurar (idempotent):
tüm konum/adres/öneri tabloları + RLS + **81 il + 973 ilçe** + güvenlik düzeltmeleri.

### 2b) Production sıkılaştırma (YENİ — ayrı paste)
SQL Editor → **New query** → `supabase/migrations/20260630140000_production_hardening.sql`
dosyasının tamamını yapıştır → **Run**. Bu migration şunları ekler (idempotent):
- İlan/ortaklık status genişletme (`pending_review`, `expired`, `cancelled`, `completed`)
- Genişletilmiş roller (`seller`, `partner`, `super_admin`) + `is_admin()` güncellemesi
- Eksik performans index'leri (kategori/fiyat/tarih/komisyon vb.)
- **Soft-delete** (`deleted_at`) — kritik tablolarda veri kaybı önleme
- **activity_logs** (denetim/audit kaydı) + RLS (yalnız admin okur)
- **rate_limits** + `check_rate_limit()` RPC (spam/bot koruması)
- **prohibited_keywords** + `scan_prohibited()` RPC (yasaklı ürün taraması)

> Not: `ALTER TYPE ... ADD VALUE` transaction kısıtı nedeniyle bu dosyayı
> setup-all.sql ile **aynı** sorguda değil, **ayrı** çalıştırın.

Alternatif (CLI ile, hepsi sırayla uygulanır):
```
npx supabase login
npx supabase link --project-ref akyzzdwbzgsnhdircuce
npx supabase db push
```
Uygulanan migration'lar arasında:
- `20260630120000_locations_addresses_suggestions.sql` — il/ilçe/mahalle/adres/öneri tabloları + RLS + `approve_location_suggestion()`
- `20260630130000_security_hardening.sql` — Security Advisor düzeltmeleri (search_path, SECURITY DEFINER revoke, bucket listeleme kapatma)
- `20260630140000_production_hardening.sql` — status/rol genişletme, index, soft-delete, activity_logs, rate_limits, prohibited_keywords (bkz. 2b)

## 3) Konum verisi
```
# il + ilçe (anında, idempotent)
psql "postgresql://postgres:<DB-PAROLAN>@db.akyzzdwbzgsnhdircuce.supabase.co:5432/postgres" -f supabase/seed/seed-locations.sql

# tam mahalle (~50k, resmi kaynaktan indirir, upsert)
SUPABASE_URL="https://akyzzdwbzgsnhdircuce.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<YENİ-SECRET-KEY>" \
node supabase/seed/seed-neighborhoods.mjs
```

## 4) Dashboard ayarları
- **Authentication → URL Configuration → Site URL**: `http://localhost:3000` yerine canlı/preview domainini yaz; Redirect URL ekle (yoksa e-posta doğrulama / şifre sıfırlama linkleri çalışmaz).
- **Authentication → Sign In/Providers → Email**: "Confirm email" açık (öneri). İlk sürümde e-posta doğrulama akışı çalışır.
- **Security Advisor → Leaked Password Protection**: aç.

## 5) Davranış
- Supabase ayarlıysa: il/ilçe/mahalle API'den çekilir, öneriler DB'ye yazılır, kayıt/giriş/şifre canlı çalışır.
- **Giriş gerektirmeyen:** ana sayfa, keşfet, kategoriler, ilan detayı, blog, yasal sayfalar — herkes gezer.
- **Giriş gerektiren:** ilan ver, favoriler, mesajlar, kazançlar, hesabım, ayarlar, yönetim paneli (giriş yapılmadan `AuthRequired` kartı gösterilir, `/auth`'a yönlendirir).
- Supabase ayarlı değilse uygulama paket verisiyle (önizleme) çalışmaya devam eder.
