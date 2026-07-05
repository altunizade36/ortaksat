-- Favoriye eklerken ilanın o anki fiyatını sakla; favoriler sayfasında fiyat
-- düşüşü/artışı göstergesi (spec 75 "Fiyat Değişince Bildir") için kullanılır.
alter table public.favorites
  add column if not exists saved_price numeric;
