-- ============================================================================
-- 2026-07-07 — Standartlara hizalı kategori taksonomisi (DB-destekli)
-- Kaynaklar: Google Product Taxonomy (ürün), Meta Product Categories, GS1 GPC,
-- Schema.org Product; dikey (emlak/vasıta/iş/hizmet/yedek parça) ilan mantığı
-- sahibinden/arabam/hepsiemlak/armut/kariyer.net akışlarından türetildi.
-- category_seed.json (scripts/build-category-seed.mts) buraya yüklenir.
-- ============================================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete cascade,
  slug text not null,                        -- kendi slug'ı (parent altında benzersiz)
  path text not null unique,                 -- tam slug yolu: "emlak/konut/satilik"
  name text not null,                        -- Türkçe görünen ad
  name_en text,                              -- İngilizce (i18n)
  full_name text,                            -- "Emlak > Konut > Satılık"
  level int not null default 0,
  sort_order int not null default 0,
  kind text not null default 'product',      -- product|vehicle|realestate|job|service|part|industrial|pet|digital|request|other
  is_leaf boolean not null default false,
  -- Standart taksonomi eşleşmeleri (Google Shopping / Meta katalog / GS1 feed'leri için)
  google_product_category_id int,            -- Google Product Taxonomy ID
  google_product_category text,              -- Google tam yol (referans)
  meta_category text,                         -- Meta/Facebook katalog kategorisi
  gs1_brick text,                             -- GS1 GPC brick kodu/adı
  -- İlan formu (mevcut lib/category-tree.ts formSchemas ile uyumlu)
  form_schema_key text,                      -- hangi form şeması
  attributes jsonb not null default '[]'::jsonb,  -- kategori-özel alan tanımları (FieldDef[])
  icon text,
  image_url text,
  keywords text,                             -- arama/eşanlam (SEO + öneri)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_id, slug)
);

create index if not exists categories_parent_idx on public.categories(parent_id);
create index if not exists categories_kind_idx on public.categories(kind);
create index if not exists categories_leaf_idx on public.categories(is_leaf) where is_leaf;
create index if not exists categories_google_idx on public.categories(google_product_category_id);
create index if not exists categories_active_sort_idx on public.categories(active, level, sort_order);

-- RLS: herkes okur (kategori ağacı public), yalnız admin yazar.
alter table public.categories enable row level security;
drop policy if exists "categories readable" on public.categories;
create policy "categories readable" on public.categories for select using (true);
drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

select 'categories table ready' as status;
