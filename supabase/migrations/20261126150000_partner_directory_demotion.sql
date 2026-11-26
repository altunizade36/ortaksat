-- Ortak dizininde "geri plana alma": yönetimin seçtiği ortak tam dizinde (/ortaklar) EN SONDA listelenir ve
-- ana sayfadaki "Öne Çıkan Ortaklar" şeridi gibi kısa vitrin listelerinde (p_limit <= 12) hiç yer almaz.
-- Kısa liste kuralı sunucuda olduğu için yayındaki uygulama sürümleri de güncelleme gerektirmeden uyar.
--
-- Liste ayrı bir tabloda durur (profiles'ta sütun DEĞİL): kullanıcı kendi profil satırını güncelleyebildiği için
-- sütun olsaydı kendini listeden çıkarabilirdi. Tabloda RLS açık ve hiçbir policy yok → istemciden okunamaz /
-- yazılamaz; yalnız aşağıdaki SECURITY DEFINER fonksiyon okur. Ekleme / çıkarma yönetim SQL'iyle yapılır:
--   insert into public.partner_directory_demotions (partner_id) values ('<profil id>') on conflict do nothing;
--   delete from public.partner_directory_demotions where partner_id = '<profil id>';

create table if not exists public.partner_directory_demotions (
  partner_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.partner_directory_demotions enable row level security;
revoke all on public.partner_directory_demotions from anon, authenticated;

create or replace function public.partner_directory(p_category text default null, p_sort text default 'performance', p_limit integer default 60, p_city text default null)
returns table(partner_id uuid, full_name text, avatar_url text, verified_identity boolean, verified_phone boolean, rating numeric, confirmed_sales bigint, paid_earned numeric, active_partnerships bigint, completed_partnerships bigint, favorite_count bigint, expertise_categories text[], city text)
language sql
stable security definer
set search_path to 'public'
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
      (select count(*) from public.partner_favorites pf where pf.partner_id = pr.id)::bigint as favs,
      exists (select 1 from public.partner_directory_demotions d where d.partner_id = pr.id) as demoted
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
    -- kısa vitrin listeleri (ana sayfa şeridi 12 ister): geri plana alınan ortak hiç gelmez
    and (not demoted or coalesce(p_limit, 60) > 12)
  order by
    demoted asc,
    case when p_sort = 'favorites' then favs end desc nulls last,
    case when p_sort = 'recent'    then active_p + completed_p end desc nulls last,
    confirmed desc, earned desc, favs desc, full_name asc
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$function$;
