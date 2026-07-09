-- listing_public_cards görünümü security_invoker=true olduğundan anon rolüyle
-- sorgulanınca alttaki listings tablosunun KOLON izinleriyle çalışır. Görünüme yapısal
-- konum kolonları (province_id/district_id/neighborhood_id) eklendi; ancak 20260704140000
-- migrasyonu anon'un kolon SELECT izinlerini kısıtlamıştı → anon'un select('*') çağrısı
-- bu kolonlarda "permission denied" veriyordu (çıkış yapmış ziyaretçiler için tüm feed).
-- Konum kolonları hassas değil (il/ilçe zaten ilanda herkese görünür); SELECT açılır.
grant select (province_id, district_id, neighborhood_id) on public.listings to anon, authenticated;
