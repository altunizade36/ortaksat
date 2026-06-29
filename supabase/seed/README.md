# OrtakSat — Adres (il/ilçe/mahalle) kurulumu

Merkezi Türkiye adres sistemi: ilan oluşturma, filtreleme, profil/mağaza/teslimat
adresleri **aynı** tabloları kullanır.

## 1. Şema
Migration otomatik uygulanır:
```
supabase db push        # veya: supabase migration up
```
`20260630120000_locations_addresses_suggestions.sql` şunları oluşturur:
`provinces, districts, neighborhoods, addresses, location_suggestions,
category_suggestions` + `listings.province_id/district_id/neighborhood_id/
address_visibility/location_note` + RLS + `approve_location_suggestion()`.

## 2. İl + İlçe seed (anında)
81 il, 973 ilçe — idempotent (tekrar çalıştırılabilir):
```
psql "$DATABASE_URL" -f supabase/seed/seed-locations.sql
# veya Supabase SQL editöründe dosyayı yapıştır.
```

## 3. Mahalle seed (tam veri, ~50k)
Mahalle verisi büyük olduğu için frontend'e gömülmez; resmi kaynaktan indirilip
DB'ye yüklenir (idempotent):
```
SUPABASE_URL="https://xxx.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="..." \
node supabase/seed/seed-neighborhoods.mjs
```
- Service-role anahtarı yalnızca yerelde/sunucuda kullanılır, istemciye konmaz.
- Mahalleler projedeki il/ilçe id'lerine (plaka kodu tabanlı) eşlenir.
- `district_id*100000 + sıra` ile stabil id; tekrar çalıştırınca duplicate olmaz.

## 4. RLS özeti
- `provinces/districts/neighborhoods`: herkes okur, yalnızca admin yazar.
- `addresses`: yalnızca sahibi (admin hepsini görür).
- `location_suggestions / category_suggestions`: kullanıcı kendi önerisini
  oluşturur ve görür; admin yönetir. Mahalle önerisi admin onayında
  `approve_location_suggestion(id)` ile `neighborhoods`'a eklenir.

## 5. Uygulama davranışı
- Supabase **ayarlı değilse**: uygulama paketteki 81 il + 973 ilçe ile çalışır,
  mahalle "serbest giriş + öneri" akışıyla yürür (`lib/location-service.ts`).
- Supabase **ayarlıysa**: il/ilçe/mahalle API'den çekilir, öneriler DB'ye yazılır.
