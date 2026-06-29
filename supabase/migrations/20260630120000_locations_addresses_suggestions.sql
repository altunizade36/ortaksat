-- OrtakSat: merkezi Türkiye adres sistemi (il/ilçe/mahalle) + kullanıcı adresleri
-- + konum & kategori önerileri. İlan, filtre, profil, mağaza ve teslimat adresleri
-- aynı tabloları kullanır. Reference tablolar herkese açık okunur; yazma adminde.

create extension if not exists pgcrypto;

-- generic updated_at touch ------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ========================================================================
-- REFERENCE: provinces / districts / neighborhoods
-- ========================================================================
create table if not exists public.provinces (
  id          integer primary key,          -- plaka kodu = il id
  name        text not null,
  slug        text not null unique,
  plate_code  integer,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.districts (
  id          integer primary key,
  province_id integer not null references public.provinces(id) on delete cascade,
  name        text not null,
  slug        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (province_id, slug)
);
create index if not exists districts_province_idx on public.districts(province_id);

create table if not exists public.neighborhoods (
  id          bigint primary key,
  province_id integer not null references public.provinces(id) on delete cascade,
  district_id integer not null references public.districts(id) on delete cascade,
  name        text not null,
  type        text,                          -- Mahalle / Köy / Belde
  slug        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (district_id, slug)                 -- aynı mahalle adı farklı ilçelerde olabilir
);
create index if not exists neighborhoods_district_idx on public.neighborhoods(district_id);
create index if not exists neighborhoods_province_idx on public.neighborhoods(province_id);

-- ========================================================================
-- USER ADDRESSES (mağaza / teslimat / fatura / ilan konumu)
-- ========================================================================
do $$ begin
  create type public.address_type as enum ('listing_location', 'store_address', 'delivery_address', 'billing_address');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.address_visibility as enum ('city_only', 'district_only', 'neighborhood', 'full_address_private');
exception when duplicate_object then null; end $$;

create table if not exists public.addresses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  province_id     integer references public.provinces(id),
  district_id     integer references public.districts(id),
  neighborhood_id bigint  references public.neighborhoods(id),
  address_line    text,
  postal_code     text,
  latitude        double precision,
  longitude       double precision,
  address_type    public.address_type not null default 'store_address',
  is_default      boolean not null default false,
  visibility      public.address_visibility not null default 'neighborhood',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id);

-- ========================================================================
-- SUGGESTIONS (eksik mahalle/ilçe + eksik kategori önerileri)
-- ========================================================================
do $$ begin
  create type public.suggestion_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.location_suggestions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  province_id    integer references public.provinces(id),
  district_id    integer references public.districts(id),
  suggested_name text not null,
  type           text not null default 'neighborhood',   -- neighborhood / district
  note           text,
  status         public.suggestion_status not null default 'pending',
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists location_suggestions_status_idx on public.location_suggestions(status);

create table if not exists public.category_suggestions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  listing_id     uuid references public.listings(id) on delete set null,
  suggested_path text not null,                            -- "Ana > Alt > Detay"
  note           text,
  status         public.suggestion_status not null default 'pending',
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists category_suggestions_status_idx on public.category_suggestions(status);

-- ========================================================================
-- LISTINGS: yapısal konum kolonları (string yerine id)
-- ========================================================================
alter table public.listings add column if not exists province_id     integer references public.provinces(id);
alter table public.listings add column if not exists district_id     integer references public.districts(id);
alter table public.listings add column if not exists neighborhood_id bigint  references public.neighborhoods(id);
alter table public.listings add column if not exists address_visibility public.address_visibility not null default 'neighborhood';
alter table public.listings add column if not exists location_note   text;
create index if not exists listings_province_idx on public.listings(province_id);
create index if not exists listings_district_idx on public.listings(district_id);

-- updated_at triggers -----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['provinces','districts','neighborhoods','addresses','location_suggestions','category_suggestions']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ========================================================================
-- RLS
-- ========================================================================
alter table public.provinces            enable row level security;
alter table public.districts            enable row level security;
alter table public.neighborhoods        enable row level security;
alter table public.addresses            enable row level security;
alter table public.location_suggestions enable row level security;
alter table public.category_suggestions enable row level security;

-- Reference data: herkes okur, sadece admin yazar
do $$
declare t text;
begin
  foreach t in array array['provinces','districts','neighborhoods']
  loop
    execute format('drop policy if exists "%1$s_read_all" on public.%1$s', t);
    execute format('create policy "%1$s_read_all" on public.%1$s for select using (true)', t);
    execute format('drop policy if exists "%1$s_admin_write" on public.%1$s', t);
    execute format('create policy "%1$s_admin_write" on public.%1$s for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Addresses: sadece sahibi (admin hepsini görür)
drop policy if exists "addresses_owner_select" on public.addresses;
create policy "addresses_owner_select" on public.addresses
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "addresses_owner_modify" on public.addresses;
create policy "addresses_owner_modify" on public.addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Location suggestions: kullanıcı kendi önerisini oluşturur/görür; admin yönetir
drop policy if exists "loc_sugg_insert" on public.location_suggestions;
create policy "loc_sugg_insert" on public.location_suggestions
  for insert with check (auth.uid() is not null and user_id = auth.uid());
drop policy if exists "loc_sugg_select" on public.location_suggestions;
create policy "loc_sugg_select" on public.location_suggestions
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "loc_sugg_admin_update" on public.location_suggestions;
create policy "loc_sugg_admin_update" on public.location_suggestions
  for update using (public.is_admin()) with check (public.is_admin());

-- Category suggestions: aynı kural
drop policy if exists "cat_sugg_insert" on public.category_suggestions;
create policy "cat_sugg_insert" on public.category_suggestions
  for insert with check (auth.uid() is not null and user_id = auth.uid());
drop policy if exists "cat_sugg_select" on public.category_suggestions;
create policy "cat_sugg_select" on public.category_suggestions
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "cat_sugg_admin_update" on public.category_suggestions;
create policy "cat_sugg_admin_update" on public.category_suggestions
  for update using (public.is_admin()) with check (public.is_admin());

-- ========================================================================
-- Admin onay yardımcıları (mahalle önerisini onaylayıp tabloya ekleme)
-- ========================================================================
create or replace function public.approve_location_suggestion(suggestion_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.location_suggestions;
  new_id bigint;
  new_slug text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into s from public.location_suggestions where id = suggestion_id;
  if not found then raise exception 'suggestion not found'; end if;

  new_slug := regexp_replace(lower(translate(s.suggested_name,
    'çğıöşüÇĞİÖŞÜ', 'cgiosucgiosu')), '[^a-z0-9]+', '-', 'g');
  select coalesce(max(id), s.district_id::bigint * 100000) + 1 into new_id
  from public.neighborhoods where district_id = s.district_id;

  insert into public.neighborhoods (id, province_id, district_id, name, type, slug)
  values (new_id, s.province_id, s.district_id, s.suggested_name, s.type, new_slug)
  on conflict (district_id, slug) do nothing;

  update public.location_suggestions
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = suggestion_id;
  return new_id;
end;
$$;
