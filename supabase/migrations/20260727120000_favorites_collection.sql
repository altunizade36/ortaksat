-- Koleksiyonlar (favori-klasör): favori bir "koleksiyon" adına (emoji dahil) atanabilir.
-- Ayrı tablo YOK — koleksiyon = distinct favorites.collection değerleri (basit, izole,
-- çekirdek akışa dokunmaz). favorites zaten user-private + RLS'li → ekstra policy gerekmez.
alter table public.favorites add column if not exists collection text;
