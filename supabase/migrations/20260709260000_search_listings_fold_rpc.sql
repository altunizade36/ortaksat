-- Sunucu-tarafı Türkçe-duyarsız + typo-toleranslı arama.
-- Sorun: PostgREST ilike aksan/Türkçe-harf duyarsız DEĞİL ("sarj"≠"şarj") ve typo'da 0
-- döner; istemci fallback yalnız yüklü 90 satırda arıyordu. Bu RPC tüm katalogda
-- lower(unaccent(...)) katlamasıyla eşleşir ve trigram benzerliğiyle sıralar.
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- IMMUTABLE katlama sarmalayıcısı (tek-argümanlı unaccent STABLE'dır; fonksiyonel indeks
-- IMMUTABLE ister). İki-argümanlı unaccent('unaccent', $1) IMMUTABLE kabul edilir.
create or replace function public.f_unaccent(text)
  returns text
  language sql
  immutable
  parallel safe
  strict
  set search_path = public
  as $$ select lower(unaccent('unaccent', $1)) $$;

-- Katlanmış (Türkçe-duyarsız) trigram GIN indeksleri → RPC'deki like '%..%' hızlanır.
create index if not exists idx_listings_fold_title on public.listings using gin (public.f_unaccent(title) gin_trgm_ops);
create index if not exists idx_listings_fold_desc on public.listings using gin (public.f_unaccent(coalesce(description, '')) gin_trgm_ops);
create index if not exists idx_listings_fold_cat on public.listings using gin (public.f_unaccent(category) gin_trgm_ops);
create index if not exists idx_listings_fold_loc on public.listings using gin (public.f_unaccent(coalesce(location, '')) gin_trgm_ops);

-- Arama RPC'si: katlanmış eşleşme + trigram-benzerlik sıralaması. security invoker →
-- listing_public_cards (RLS-güvenli görünüm) çağıranın yetkisiyle çalışır; anon aktif
-- public ilanları görür. Aynı satır şekli (listing_public_cards) → istemci mapListing çalışır.
create or replace function public.search_listings(q text, lim int default 40, off int default 0)
  returns setof public.listing_public_cards
  language sql
  stable
  security invoker
  set search_path = public
  as $$
    select c.*
    from public.listing_public_cards c
    where c.status = 'active'
      and (
        public.f_unaccent(c.title) like '%' || public.f_unaccent(q) || '%'
        or public.f_unaccent(coalesce(c.description, '')) like '%' || public.f_unaccent(q) || '%'
        or public.f_unaccent(c.category) like '%' || public.f_unaccent(q) || '%'
        or public.f_unaccent(coalesce(c.location, '')) like '%' || public.f_unaccent(q) || '%'
      )
    order by similarity(public.f_unaccent(c.title), public.f_unaccent(q)) desc, c.featured desc nulls last, c.created_at desc
    limit greatest(1, least(lim, 100)) offset greatest(0, off);
  $$;

grant execute on function public.search_listings(text, int, int) to anon, authenticated, service_role;
