-- Bölgesel ortaklık (FAZ 7): kullanıcı ili + şehir-bazlı ortak dizini/sıralaması.
-- Yeni AYRI tablo yok; profiles.city (text) + mevcut SECURITY DEFINER fonksiyonları city döndürür.
-- Yönetim API'siyle canlıya uygulandı; bu dosya repo kaydıdır.

-- 1) İl kolonu (TR_PROVINCES adı). city public bilgidir → anon SELECT grant (UPDATE zaten RLS-kilitli, öz-satır dışı engellenir).
alter table public.profiles add column if not exists city text;
grant select (city) on public.profiles to anon, authenticated;

-- 2) partner_directory: p_city filtresi + city kolonu (şehir-bazlı sıralama tek RPC'den; ayrı leaderboard view yok).
drop function if exists public.partner_directory(text, text, integer);
create or replace function public.partner_directory(
  p_category text default null,
  p_sort text default 'performance',
  p_limit integer default 60,
  p_city text default null
)
returns table(partner_id uuid, full_name text, avatar_url text, verified_identity boolean, verified_phone boolean, rating numeric, confirmed_sales bigint, paid_earned numeric, active_partnerships bigint, completed_partnerships bigint, favorite_count bigint, expertise_categories text[], city text)
language sql stable security definer set search_path to 'public'
as $function$
  with agg as (
    select pr.id, pr.full_name, pr.avatar_url, pr.verified_identity, pr.verified_phone, pr.rating,
      coalesce(pr.expertise_categories, '{}') as expertise, pr.city as city,
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
    confirmed, earned, active_p, completed_p, favs, expertise, city
  from agg
  where (p_category is null or p_category = any (expertise))
    and (p_city is null or lower(city) = lower(p_city))
  order by
    case when p_sort = 'favorites' then favs end desc nulls last,
    case when p_sort = 'recent'    then active_p + completed_p end desc nulls last,
    confirmed desc, earned desc, favs desc, full_name asc
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$function$;
grant execute on function public.partner_directory(text, text, integer, text) to anon, authenticated;

-- 3) my_favorite_partners: city kolonu (dizinle aynı kart şekli).
drop function if exists public.my_favorite_partners();
create or replace function public.my_favorite_partners()
returns table(partner_id uuid, full_name text, avatar_url text, verified_identity boolean, verified_phone boolean, rating numeric, confirmed_sales bigint, paid_earned numeric, active_partnerships bigint, completed_partnerships bigint, favorite_count bigint, expertise_categories text[], city text)
language sql stable security definer set search_path to 'public'
as $function$
  select pr.id, pr.full_name, pr.avatar_url, pr.verified_identity, pr.verified_phone, pr.rating,
    (select count(*) from commissions c join partnerships pt on pt.id = c.partnership_id
       where pt.partner_id = pr.id and c.status = any (array['approved','seller_paid','paid']::commission_status[]))::bigint,
    (select coalesce(sum(c.amount), 0) from commissions c join partnerships pt on pt.id = c.partnership_id
       where pt.partner_id = pr.id and c.status = 'paid')::numeric,
    (select count(*) from partnerships pt join listings l on l.id = pt.listing_id
       where pt.partner_id = pr.id and pt.status = 'active' and l.status = 'active')::bigint,
    (select count(*) from partnerships pt where pt.partner_id = pr.id and pt.status = 'completed')::bigint,
    (select count(*) from public.partner_favorites pf2 where pf2.partner_id = pr.id)::bigint,
    coalesce(pr.expertise_categories, '{}'), pr.city
  from public.partner_favorites pf
  join profiles pr on pr.id = pf.partner_id
  where pf.favoriter_id = auth.uid()
  order by pf.created_at desc;
$function$;
grant execute on function public.my_favorite_partners() to authenticated;

-- 4) partner_public_profile: herkese-açık vitrin başlığında şehir.
drop function if exists public.partner_public_profile(uuid);
create or replace function public.partner_public_profile(p_id uuid)
returns table(partner_id uuid, full_name text, avatar_url text, verified_identity boolean, verified_phone boolean, rating numeric, confirmed_sales bigint, active_partnerships bigint, completed_partnerships bigint, favorite_count bigint, expertise_categories text[], city text)
language sql stable security definer set search_path to 'public'
as $function$
  select pr.id, pr.full_name, pr.avatar_url, pr.verified_identity, pr.verified_phone, pr.rating,
    (select count(*) from commissions c join partnerships pt2 on pt2.id = c.partnership_id
       where pt2.partner_id = pr.id and c.status = any (array['approved','seller_paid','paid']::commission_status[])),
    (select count(*) from partnerships pt3 join listings l3 on l3.id = pt3.listing_id
       where pt3.partner_id = pr.id and pt3.status = 'active' and l3.status = 'active'),
    (select count(*) from partnerships pt4 where pt4.partner_id = pr.id and pt4.status = 'completed'),
    (select count(*) from partner_favorites pf where pf.partner_id = pr.id),
    coalesce(pr.expertise_categories, '{}'), pr.city
  from profiles pr where pr.id = p_id;
$function$;
grant execute on function public.partner_public_profile(uuid) to anon, authenticated;
