-- Site duyurusu (ozel metin banner) + one cikan ilan (featured).

-- 1) platform_settings: duyuru metni + aktif bayragi.
alter table public.platform_settings
  add column if not exists announcement text not null default '',
  add column if not exists announcement_active boolean not null default false;

-- 2) listings: one cikan (featured) bayragi. Admin isaretler; katalogda one alinir.
alter table public.listings
  add column if not exists featured boolean not null default false;

create index if not exists listings_featured_idx on public.listings (featured) where featured = true;
