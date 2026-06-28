alter type public.lead_status add value if not exists 'interested';
alter type public.commission_status add value if not exists 'return_pending';
alter type public.commission_status add value if not exists 'seller_paid';
alter type public.commission_status add value if not exists 'cancelled';
alter type public.commission_status add value if not exists 'disputed';

alter table public.listings
  add column if not exists share_templates jsonb,
  add column if not exists ad_assets text[] not null default '{}';

alter table public.partnerships
  add column if not exists share_channel text,
  add column if not exists audience text,
  add column if not exists platform_handle text,
  add column if not exists reach_estimate integer not null default 0 check (reach_estimate >= 0);

alter table public.commissions
  add column if not exists lead_id uuid references public.leads(id),
  add column if not exists sale_amount numeric(12,2),
  add column if not exists quantity integer not null default 1 check (quantity > 0),
  add column if not exists buyer_name text,
  add column if not exists delivery_status public.order_status not null default 'confirmed',
  add column if not exists return_until date,
  add column if not exists seller_marked_paid_at timestamptz,
  add column if not exists partner_confirmed_paid_at timestamptz;

drop view if exists public.listing_public_cards;

create view public.listing_public_cards
with (security_invoker = true) as
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

grant select on public.listing_public_cards to anon, authenticated;

drop policy if exists "partners update own commission confirmation" on public.commissions;
create policy "partners update own commission confirmation" on public.commissions for update using (
  exists (
    select 1 from public.partnerships p
    where p.id = partnership_id and p.partner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.partnerships p
    where p.id = partnership_id and p.partner_id = auth.uid()
  )
);
