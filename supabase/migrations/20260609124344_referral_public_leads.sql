create or replace view public.referral_public_links as
select
  p.ref_code,
  p.id as partnership_id,
  p.listing_id,
  l.slug,
  l.title,
  l.price,
  l.commission_type,
  l.commission_value,
  l.category,
  l.location,
  (
    select li.url
    from public.listing_images li
    where li.listing_id = l.id
    order by li.sort_order asc
    limit 1
  ) as image_url
from public.partnerships p
join public.listings l on l.id = p.listing_id
where p.status = 'active' and l.status = 'active';

create policy "public buyers create referral leads" on public.leads for insert with check (
  exists (
    select 1
    from public.partnerships p
    join public.listings l on l.id = p.listing_id
    where p.id = partnership_id
      and p.listing_id = leads.listing_id
      and p.status = 'active'
      and l.status = 'active'
  )
);

grant select on public.referral_public_links to anon, authenticated;
grant insert on public.leads to anon;
