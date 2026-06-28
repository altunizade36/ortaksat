drop view if exists public.listing_public_cards;

create view public.listing_public_cards as
select
  l.id,
  l.owner_id,
  l.title,
  l.slug,
  l.description,
  l.sales_pitch,
  l.share_templates,
  l.ad_assets,
  l.tags,
  l.price,
  l.commission_type,
  l.commission_value,
  l.category,
  l.location,
  l.status,
  l.partnership_mode,
  l.stock_count,
  l.min_partner_rating,
  l.commission_due_days,
  l.return_window_days,
  l.partner_rules,
  l.delivery_note,
  l.contact_method,
  l.created_at,
  (
    select li.url
    from public.listing_images li
    where li.listing_id = l.id
    order by li.sort_order asc
    limit 1
  ) as image_url,
  (
    select count(*)
    from public.partnerships p
    where p.listing_id = l.id and p.status = 'active'
  ) as partner_count,
  (
    select count(*)
    from public.leads le
    where le.listing_id = l.id
  ) as lead_count,
  (
    select count(*)
    from public.favorites f
    where f.listing_id = l.id
  ) as favorite_count,
  (
    select count(*)
    from public.reviews r
    where r.listing_id = l.id
  ) as review_count
from public.listings l
where l.status = 'active';

comment on view public.listing_public_cards is
  'Public marketplace card view. Exposes listing card fields and aggregate counts only; sensitive partnership, lead, favorite, and review rows remain protected by table RLS.';

grant select on public.listing_public_cards to anon, authenticated;
