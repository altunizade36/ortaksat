-- Herkese-açık ortak vitrini: bir ortağın AKTİF ortaklıklarındaki aktif ilanlar + ref_code.
-- partnerships RLS-korumalı olduğundan SECURITY DEFINER (yalnız güvenli-public alanlar döner).
create or replace function public.partner_public_shop(p_id uuid)
returns table (listing_id uuid, ref_code text)
language sql security definer set search_path = public stable as $$
  select pt.listing_id, pt.ref_code
  from partnerships pt
  join listings l on l.id = pt.listing_id
  where pt.partner_id = p_id and pt.status = 'active' and l.status = 'active'
  order by l.created_at desc
  limit 200;
$$;
revoke all on function public.partner_public_shop(uuid) from public;
grant execute on function public.partner_public_shop(uuid) to anon, authenticated;

create or replace function public.partner_public_profile(p_id uuid)
returns table (partner_id uuid, full_name text, verified_identity boolean, verified_phone boolean, confirmed_sales bigint, active_partnerships bigint)
language sql security definer set search_path = public stable as $$
  select pr.id, pr.full_name, pr.verified_identity, pr.verified_phone,
    (select count(*) from commissions c join partnerships pt2 on pt2.id = c.partnership_id
       where pt2.partner_id = pr.id and c.status = any(array['approved','seller_paid','paid']::commission_status[])),
    (select count(*) from partnerships pt3 join listings l3 on l3.id = pt3.listing_id
       where pt3.partner_id = pr.id and pt3.status = 'active' and l3.status = 'active')
  from profiles pr where pr.id = p_id;
$$;
revoke all on function public.partner_public_profile(uuid) from public;
grant execute on function public.partner_public_profile(uuid) to anon, authenticated;
drop function if exists public.partner_public_shop(uuid);
create or replace function public.partner_public_shop(p_id uuid)
returns table (listing_id uuid, ref_code text, partnership_id uuid)
language sql security definer set search_path = public stable as $$
  select pt.listing_id, pt.ref_code, pt.id
  from partnerships pt
  join listings l on l.id = pt.listing_id
  where pt.partner_id = p_id and pt.status = 'active' and l.status = 'active'
  order by l.created_at desc
  limit 200;
$$;
revoke all on function public.partner_public_shop(uuid) from public;
grant execute on function public.partner_public_shop(uuid) to anon, authenticated;
