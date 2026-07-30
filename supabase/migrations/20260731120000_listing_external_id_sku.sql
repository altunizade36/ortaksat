-- TOPLU YÜKLEME SENKRONİZASYONU — Harici Ürün Kodu (SKU / External ID).
-- Büyük pazaryeri modeli (Trendyol/Sahibinden): satıcı aynı dosyayı tekrar yükleyince
-- sistem SKU üzerinden mevcut ilanı GÜNCELLER (yeni oluşturmaz). Bunun için ilanların
-- satıcıya-özel benzersiz bir harici kodu olmalı.
alter table public.listings add column if not exists external_id text;

-- (owner_id, external_id) benzersiz — bir satıcının SKU'su kendi içinde tekildir; FARKLI
-- satıcılar aynı SKU'yu kullanabilir. Boş/NULL external_id kısıtlanmaz (SKU opsiyonel).
create unique index if not exists listings_owner_external_id_uniq
  on public.listings (owner_id, external_id)
  where external_id is not null and external_id <> '';

comment on column public.listings.external_id is 'Satıcının harici ürün kodu (SKU). Toplu yüklemede upsert anahtarı; (owner_id, external_id) tekil.';
