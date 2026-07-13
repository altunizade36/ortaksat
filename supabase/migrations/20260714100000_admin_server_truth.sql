-- ---------------------------------------------------------------------------
-- ADMIN — SUNUCU GERÇEĞİ (server truth)
--
-- SORUN: admin.tsx TÜM verisini useStore()'dan (istemci bellek penceresi) alıyordu.
--  • İlanlar `listing_public_cards` (HERKESE AÇIK view) üzerinden geliyordu → admin
--    pasif/satılmış/arşiv/reddedilmiş ilanları GÖREMİYORDU.
--  • Sayılar bellek penceresiyle sınırlıydı → ölçekte YANLIŞ rakamlar.
--  • Kayıt tabloları sayfalanmıyordu → binlerce satır istemciye yığılırdı.
--
-- ÇÖZÜM: is_admin() korumalı, SECURITY DEFINER RPC'ler. Gerçek tablolardan okur,
-- sunucuda sayar/sayfalar/arar. Admin olmayan çağırırsa hata alır.
-- ---------------------------------------------------------------------------

-- 1) GENEL BAKIŞ — operasyonel varlıkların GERÇEK sayıları (bellek penceresinden değil)
create or replace function public.admin_overview()
returns json language plpgsql security definer set search_path to 'public' as $fn$
declare result json;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select json_build_object(
    'listings', (select json_object_agg(status, n) from (select status, count(*) n from public.listings group by status) s),
    'listings_total', (select count(*) from public.listings),
    'users_total', (select count(*) from public.profiles),
    'users_by_role', (select json_object_agg(role, n) from (select role, count(*) n from public.profiles group by role) r),
    'users_suspended', (select count(*) from public.profiles where status = 'suspended'),
    'partnerships', (select json_object_agg(status, n) from (select status, count(*) n from public.partnerships group by status) p),
    'commissions', (select json_object_agg(status, n) from (select status, count(*) n from public.commissions group by status) c),
    'gmv', (select coalesce(sum(amount), 0) from public.orders),
    'orders_total', (select count(*) from public.orders),
    'commission_volume', (select coalesce(sum(amount), 0) from public.commissions),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'reports_total', (select count(*) from public.reports),
    'leads_total', (select count(*) from public.leads),
    'cat_suggestions_pending', (select count(*) from public.category_suggestions where status = 'pending'),
    'loc_suggestions_pending', (select count(*) from public.location_suggestions where status = 'pending')
  ) into result;
  return result;
end;
$fn$;
grant execute on function public.admin_overview() to authenticated;

-- 2) İLANLAR — TÜM durumlar (public view'ın aksine), sunucuda arama + sayfalama
create or replace function public.admin_search_listings(
  p_q text default null,
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid, title text, status text, price numeric, category text, location text,
  owner_id uuid, owner_name text, created_at timestamptz, featured boolean,
  lead_count int, partner_count int, total_count bigint
)
language plpgsql security definer set search_path to 'public' as $fn$
declare v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  with base as (
    select l.*, p.full_name as o_name
    from public.listings l
    left join public.profiles p on p.id = l.owner_id
    where (p_status is null or p_status = '' or l.status::text = p_status)
      and (
        p_q is null or p_q = '' or
        l.title ilike '%' || p_q || '%' or
        l.category ilike '%' || p_q || '%' or
        l.location ilike '%' || p_q || '%' or
        coalesce(p.full_name, '') ilike '%' || p_q || '%'
      )
  ), counted as (select count(*) c from base)
  select b.id, b.title, b.status::text, b.price, b.category, b.location,
         b.owner_id, b.o_name, b.created_at, coalesce(b.featured, false),
         (select count(*)::int from public.leads le where le.listing_id = b.id),
         (select count(*)::int from public.partnerships pa where pa.listing_id = b.id and pa.status = 'active'),
         (select c from counted)
  from base b
  order by b.created_at desc
  limit v_limit offset greatest(coalesce(p_offset, 0), 0);
end;
$fn$;
grant execute on function public.admin_search_listings(text, text, int, int) to authenticated;

-- 3) KULLANICILAR — sunucuda arama + sayfalama (e-posta dahil; yalnız admin görür)
create or replace function public.admin_search_users(
  p_q text default null,
  p_role text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid, name text, email text, role text, status text, rating numeric,
  verified_phone boolean, verified_identity boolean, created_at timestamptz,
  listing_count bigint, total_count bigint
)
language plpgsql security definer set search_path to 'public', 'auth' as $fn$
declare v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  with base as (
    select p.*, u.email as u_email
    from public.profiles p
    left join auth.users u on u.id = p.id
    where (p_role is null or p_role = '' or p.role::text = p_role)
      and (
        p_q is null or p_q = '' or
        coalesce(p.full_name, '') ilike '%' || p_q || '%' or
        coalesce(u.email, '') ilike '%' || p_q || '%'
      )
  ), counted as (select count(*) c from base)
  select b.id, b.full_name::text, b.u_email::text, b.role::text, coalesce(b.status, 'active')::text,
         coalesce(b.rating, 0), coalesce(b.verified_phone, false), coalesce(b.verified_identity, false),
         b.created_at,
         (select count(*) from public.listings l where l.owner_id = b.id),
         (select c from counted)
  from base b
  order by b.created_at desc nulls last
  limit v_limit offset greatest(coalesce(p_offset, 0), 0);
end;
$fn$;
grant execute on function public.admin_search_users(text, text, int, int) to authenticated;
