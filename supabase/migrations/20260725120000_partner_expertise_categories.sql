-- ORTAK KATEGORİ UZMANLIĞI — "satıcı deneyimli/uygun ortağı tercih eder"
-- Ortak, uzman olduğu kategori(ler)i seçer; profilinde + herkese-açık vitrininde görünür.
-- Böylece satıcı, ilanının kategorisinde deneyimli bir ortak seçebilir (satış-temsilcisi pazarı).

alter table public.profiles add column if not exists expertise_categories text[] not null default '{}';

-- partner_public_profile'a expertise eklenir (satıcı ortağın uzmanlığını herkese-açık görür).
-- RETURNS TABLE değiştiği için DROP+CREATE gerekir (CREATE OR REPLACE return-type değiştiremez).
drop function if exists public.partner_public_profile(uuid);
create function public.partner_public_profile(p_id uuid)
returns table(
  partner_id uuid,
  full_name text,
  verified_identity boolean,
  verified_phone boolean,
  confirmed_sales bigint,
  active_partnerships bigint,
  expertise_categories text[]
)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select pr.id, pr.full_name, pr.verified_identity, pr.verified_phone,
    (select count(*) from commissions c join partnerships pt2 on pt2.id = c.partnership_id
       where pt2.partner_id = pr.id and c.status = any (array['approved','seller_paid','paid']::commission_status[])),
    (select count(*) from partnerships pt3 join listings l3 on l3.id = pt3.listing_id
       where pt3.partner_id = pr.id and pt3.status = 'active' and l3.status = 'active'),
    coalesce(pr.expertise_categories, '{}')
  from profiles pr where pr.id = p_id;
$fn$;
grant execute on function public.partner_public_profile(uuid) to anon, authenticated;
