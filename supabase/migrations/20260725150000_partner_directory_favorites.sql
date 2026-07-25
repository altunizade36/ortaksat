-- ORTAK DİZİNİ + FAVORİ ORTAK
-- Denetim boşluğu (keşif): satıcı, ilan kategorisinde deneyimli ortağı ARAYAMIYORDU (yalnız
-- top-8 liderlik); ve bir ortağı FAVORİLEYİP sonra bulamıyordu. İki-taraflı pazarın "ortak
-- keşfi" ayağı. Platform PARA TUTMAZ — bunlar yalnız keşif/ilişki primitifleri.

-- ============================================================================
-- 1) FAVORİ ORTAK — kullanıcı bir ortağı kaydeder ("sonra bu ortakla çalışırım")
-- ============================================================================
create table if not exists public.partner_favorites (
  id uuid primary key default gen_random_uuid(),
  favoriter_id uuid not null references auth.users(id) on delete cascade,
  partner_id   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (favoriter_id, partner_id)
);
alter table public.partner_favorites enable row level security;
create index if not exists idx_partner_favorites_favoriter on public.partner_favorites(favoriter_id);
create index if not exists idx_partner_favorites_partner   on public.partner_favorites(partner_id);

-- Kullanıcı YALNIZ kendi favorilerini görür/ekler/siler (favori listesi özeldir).
drop policy if exists "partner_favorites own select" on public.partner_favorites;
create policy "partner_favorites own select" on public.partner_favorites
  for select using (auth.uid() = favoriter_id);
drop policy if exists "partner_favorites own insert" on public.partner_favorites;
create policy "partner_favorites own insert" on public.partner_favorites
  for insert with check (auth.uid() = favoriter_id and favoriter_id <> partner_id);
drop policy if exists "partner_favorites own delete" on public.partner_favorites;
create policy "partner_favorites own delete" on public.partner_favorites
  for delete using (auth.uid() = favoriter_id);

grant select, insert, delete on public.partner_favorites to authenticated;

-- Herkese-açık AGREGAT sayaç (kaç kişi favoriledi) — SECURITY DEFINER fn ile açılır (RLS
-- favori listesini gizli tutar; yalnız sayı açığa çıkar). anon vitrinde "N kişi favoriledi".
create or replace function public.partner_favorite_count(p_id uuid)
returns bigint language sql stable security definer set search_path to 'public'
as $fn$ select count(*)::bigint from public.partner_favorites where partner_id = p_id; $fn$;
grant execute on function public.partner_favorite_count(uuid) to anon, authenticated;

-- ============================================================================
-- 2) partner_public_profile GENİŞLETME — vitrine avatar/puan/tamamlanan/favori sayısı
--    (RETURNS TABLE değişir → DROP+CREATE zorunlu; mapper güncellenmeli)
-- ============================================================================
drop function if exists public.partner_public_profile(uuid);
create function public.partner_public_profile(p_id uuid)
returns table(
  partner_id uuid,
  full_name text,
  avatar_url text,
  verified_identity boolean,
  verified_phone boolean,
  rating numeric,
  confirmed_sales bigint,
  active_partnerships bigint,
  completed_partnerships bigint,
  favorite_count bigint,
  expertise_categories text[]
)
language sql stable security definer set search_path to 'public'
as $fn$
  select pr.id, pr.full_name, pr.avatar_url, pr.verified_identity, pr.verified_phone, pr.rating,
    (select count(*) from commissions c join partnerships pt2 on pt2.id = c.partnership_id
       where pt2.partner_id = pr.id and c.status = any (array['approved','seller_paid','paid']::commission_status[])),
    (select count(*) from partnerships pt3 join listings l3 on l3.id = pt3.listing_id
       where pt3.partner_id = pr.id and pt3.status = 'active' and l3.status = 'active'),
    (select count(*) from partnerships pt4 where pt4.partner_id = pr.id and pt4.status = 'completed'),
    (select count(*) from partner_favorites pf where pf.partner_id = pr.id),
    coalesce(pr.expertise_categories, '{}')
  from profiles pr where pr.id = p_id;
$fn$;
grant execute on function public.partner_public_profile(uuid) to anon, authenticated;

-- ============================================================================
-- 3) ORTAK DİZİNİ — kategori/performansa göre aranabilir ortak listesi
--    Uygunluk: uzmanlık BEYAN etmiş VEYA aktif/tamamlanmış ortaklığı olan kullanıcılar
--    (cold-start'ta bile uzmanlık beyan eden ortaklar görünür = arz sinyali).
-- ============================================================================
create or replace function public.partner_directory(
  p_category text default null,
  p_sort text default 'performance',
  p_limit int default 60
)
returns table(
  partner_id uuid,
  full_name text,
  avatar_url text,
  verified_identity boolean,
  verified_phone boolean,
  rating numeric,
  confirmed_sales bigint,
  paid_earned numeric,
  active_partnerships bigint,
  completed_partnerships bigint,
  favorite_count bigint,
  expertise_categories text[]
)
language sql stable security definer set search_path to 'public'
as $fn$
  with agg as (
    select pr.id, pr.full_name, pr.avatar_url, pr.verified_identity, pr.verified_phone, pr.rating,
      coalesce(pr.expertise_categories, '{}') as expertise,
      (select count(*) from commissions c join partnerships pt on pt.id = c.partnership_id
         where pt.partner_id = pr.id and c.status = any (array['approved','seller_paid','paid']::commission_status[]))::bigint as confirmed,
      (select coalesce(sum(c.amount), 0) from commissions c join partnerships pt on pt.id = c.partnership_id
         where pt.partner_id = pr.id and c.status = 'paid')::numeric as earned,
      (select count(*) from partnerships pt join listings l on l.id = pt.listing_id
         where pt.partner_id = pr.id and pt.status = 'active' and l.status = 'active')::bigint as active_p,
      (select count(*) from partnerships pt where pt.partner_id = pr.id and pt.status = 'completed')::bigint as completed_p,
      (select count(*) from public.partner_favorites pf where pf.partner_id = pr.id)::bigint as favs
    from profiles pr
    where pr.full_name is not null
      and (coalesce(array_length(pr.expertise_categories, 1), 0) > 0
           or exists (select 1 from partnerships pt where pt.partner_id = pr.id and pt.status in ('active','completed')))
  )
  select id, full_name, avatar_url, verified_identity, verified_phone, rating,
    confirmed, earned, active_p, completed_p, favs, expertise
  from agg
  where (p_category is null or p_category = any (expertise))
  order by
    case when p_sort = 'favorites' then favs end desc nulls last,
    case when p_sort = 'recent'    then active_p + completed_p end desc nulls last,
    confirmed desc, earned desc, favs desc, full_name asc
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$fn$;
grant execute on function public.partner_directory(text, text, int) to anon, authenticated;

-- ============================================================================
-- 4) FAVORİ ORTAKLARIM — çağıranın favorilediği ortaklar (uygunluk filtresi YOK; favori
--    listesi kişiseldir, auth.uid() ile sınırlı). Dizinle aynı kart şekli.
-- ============================================================================
create or replace function public.my_favorite_partners()
returns table(
  partner_id uuid,
  full_name text,
  avatar_url text,
  verified_identity boolean,
  verified_phone boolean,
  rating numeric,
  confirmed_sales bigint,
  paid_earned numeric,
  active_partnerships bigint,
  completed_partnerships bigint,
  favorite_count bigint,
  expertise_categories text[]
)
language sql stable security definer set search_path to 'public'
as $fn$
  select pr.id, pr.full_name, pr.avatar_url, pr.verified_identity, pr.verified_phone, pr.rating,
    (select count(*) from commissions c join partnerships pt on pt.id = c.partnership_id
       where pt.partner_id = pr.id and c.status = any (array['approved','seller_paid','paid']::commission_status[]))::bigint,
    (select coalesce(sum(c.amount), 0) from commissions c join partnerships pt on pt.id = c.partnership_id
       where pt.partner_id = pr.id and c.status = 'paid')::numeric,
    (select count(*) from partnerships pt join listings l on l.id = pt.listing_id
       where pt.partner_id = pr.id and pt.status = 'active' and l.status = 'active')::bigint,
    (select count(*) from partnerships pt where pt.partner_id = pr.id and pt.status = 'completed')::bigint,
    (select count(*) from public.partner_favorites pf2 where pf2.partner_id = pr.id)::bigint,
    coalesce(pr.expertise_categories, '{}')
  from public.partner_favorites pf
  join profiles pr on pr.id = pf.partner_id
  where pf.favoriter_id = auth.uid()
  order by pf.created_at desc;
$fn$;
grant execute on function public.my_favorite_partners() to authenticated;
