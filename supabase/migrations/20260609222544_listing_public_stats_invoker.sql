create table if not exists public.listing_public_stats (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  partner_count bigint not null default 0,
  lead_count bigint not null default 0,
  favorite_count bigint not null default 0,
  review_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.listing_public_stats enable row level security;

drop policy if exists "listing public stats readable" on public.listing_public_stats;
create policy "listing public stats readable" on public.listing_public_stats
  for select using (true);

create or replace function private.refresh_listing_public_stats(target_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_listing_id is null then
    return;
  end if;

  insert into public.listing_public_stats (
    listing_id,
    partner_count,
    lead_count,
    favorite_count,
    review_count,
    updated_at
  )
  select
    l.id,
    (select count(*) from public.partnerships p where p.listing_id = l.id and p.status = 'active'),
    (select count(*) from public.leads le where le.listing_id = l.id),
    (select count(*) from public.favorites f where f.listing_id = l.id),
    (select count(*) from public.reviews r where r.listing_id = l.id),
    now()
  from public.listings l
  where l.id = target_listing_id
  on conflict (listing_id) do update set
    partner_count = excluded.partner_count,
    lead_count = excluded.lead_count,
    favorite_count = excluded.favorite_count,
    review_count = excluded.review_count,
    updated_at = now();
end;
$$;

create or replace function private.refresh_listing_public_stats_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing_id uuid;
begin
  target_listing_id := coalesce(new.listing_id, old.listing_id, new.id, old.id);
  perform private.refresh_listing_public_stats(target_listing_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_listing_public_stats_on_listings on public.listings;
create trigger refresh_listing_public_stats_on_listings
  after insert or update on public.listings
  for each row execute function private.refresh_listing_public_stats_trigger();

drop trigger if exists refresh_listing_public_stats_on_partnerships on public.partnerships;
create trigger refresh_listing_public_stats_on_partnerships
  after insert or update or delete on public.partnerships
  for each row execute function private.refresh_listing_public_stats_trigger();

drop trigger if exists refresh_listing_public_stats_on_leads on public.leads;
create trigger refresh_listing_public_stats_on_leads
  after insert or update or delete on public.leads
  for each row execute function private.refresh_listing_public_stats_trigger();

drop trigger if exists refresh_listing_public_stats_on_favorites on public.favorites;
create trigger refresh_listing_public_stats_on_favorites
  after insert or update or delete on public.favorites
  for each row execute function private.refresh_listing_public_stats_trigger();

drop trigger if exists refresh_listing_public_stats_on_reviews on public.reviews;
create trigger refresh_listing_public_stats_on_reviews
  after insert or update or delete on public.reviews
  for each row execute function private.refresh_listing_public_stats_trigger();

insert into public.listing_public_stats (
  listing_id,
  partner_count,
  lead_count,
  favorite_count,
  review_count,
  updated_at
)
select
  l.id,
  (select count(*) from public.partnerships p where p.listing_id = l.id and p.status = 'active'),
  (select count(*) from public.leads le where le.listing_id = l.id),
  (select count(*) from public.favorites f where f.listing_id = l.id),
  (select count(*) from public.reviews r where r.listing_id = l.id),
  now()
from public.listings l
on conflict (listing_id) do update set
  partner_count = excluded.partner_count,
  lead_count = excluded.lead_count,
  favorite_count = excluded.favorite_count,
  review_count = excluded.review_count,
  updated_at = now();

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
  coalesce(s.partner_count, 0) as partner_count,
  coalesce(s.lead_count, 0) as lead_count,
  coalesce(s.favorite_count, 0) as favorite_count,
  coalesce(s.review_count, 0) as review_count
from public.listings l
left join public.listing_public_stats s on s.listing_id = l.id
where l.status = 'active';

grant select on public.listing_public_cards to anon, authenticated;
grant select on public.listing_public_stats to anon, authenticated;

drop view if exists public.referral_public_links;

create table if not exists public.referral_public_links (
  ref_code text primary key,
  partnership_id uuid not null unique references public.partnerships(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  slug text not null,
  title text not null,
  price numeric(12,2) not null,
  commission_type text not null check (commission_type in ('rate', 'fixed')),
  commission_value numeric(12,2) not null,
  category text not null,
  location text not null,
  image_url text,
  updated_at timestamptz not null default now()
);

alter table public.referral_public_links enable row level security;

drop policy if exists "referral public links readable" on public.referral_public_links;
create policy "referral public links readable" on public.referral_public_links
  for select using (true);

create or replace function private.refresh_referral_public_link(target_partnership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_partnership_id is null then
    return;
  end if;

  delete from public.referral_public_links
  where partnership_id = target_partnership_id
    and not exists (
      select 1
      from public.partnerships p
      join public.listings l on l.id = p.listing_id
      where p.id = target_partnership_id
        and p.status = 'active'
        and l.status = 'active'
    );

  insert into public.referral_public_links (
    ref_code,
    partnership_id,
    listing_id,
    slug,
    title,
    price,
    commission_type,
    commission_value,
    category,
    location,
    image_url,
    updated_at
  )
  select
    p.ref_code,
    p.id,
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
    ),
    now()
  from public.partnerships p
  join public.listings l on l.id = p.listing_id
  where p.id = target_partnership_id
    and p.status = 'active'
    and l.status = 'active'
  on conflict (ref_code) do update set
    partnership_id = excluded.partnership_id,
    listing_id = excluded.listing_id,
    slug = excluded.slug,
    title = excluded.title,
    price = excluded.price,
    commission_type = excluded.commission_type,
    commission_value = excluded.commission_value,
    category = excluded.category,
    location = excluded.location,
    image_url = excluded.image_url,
    updated_at = now();
end;
$$;

create or replace function private.refresh_referral_public_link_from_partnership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.refresh_referral_public_link(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function private.refresh_referral_public_links_from_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  partnership_record record;
begin
  for partnership_record in
    select id from public.partnerships where listing_id = coalesce(new.id, old.id)
  loop
    perform private.refresh_referral_public_link(partnership_record.id);
  end loop;
  return coalesce(new, old);
end;
$$;

create or replace function private.refresh_referral_public_links_from_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  partnership_record record;
begin
  for partnership_record in
    select id from public.partnerships where listing_id = coalesce(new.listing_id, old.listing_id)
  loop
    perform private.refresh_referral_public_link(partnership_record.id);
  end loop;
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_referral_public_link_on_partnerships on public.partnerships;
create trigger refresh_referral_public_link_on_partnerships
  after insert or update or delete on public.partnerships
  for each row execute function private.refresh_referral_public_link_from_partnership();

drop trigger if exists refresh_referral_public_link_on_listings on public.listings;
create trigger refresh_referral_public_link_on_listings
  after update of status, slug, title, price, commission_type, commission_value, category, location on public.listings
  for each row execute function private.refresh_referral_public_links_from_listing();

drop trigger if exists refresh_referral_public_link_on_listing_images on public.listing_images;
create trigger refresh_referral_public_link_on_listing_images
  after insert or update or delete on public.listing_images
  for each row execute function private.refresh_referral_public_links_from_image();

insert into public.referral_public_links (
  ref_code,
  partnership_id,
  listing_id,
  slug,
  title,
  price,
  commission_type,
  commission_value,
  category,
  location,
  image_url,
  updated_at
)
select
  p.ref_code,
  p.id,
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
  ),
  now()
from public.partnerships p
join public.listings l on l.id = p.listing_id
where p.status = 'active' and l.status = 'active'
on conflict (ref_code) do update set
  partnership_id = excluded.partnership_id,
  listing_id = excluded.listing_id,
  slug = excluded.slug,
  title = excluded.title,
  price = excluded.price,
  commission_type = excluded.commission_type,
  commission_value = excluded.commission_value,
  category = excluded.category,
  location = excluded.location,
  image_url = excluded.image_url,
  updated_at = now();

grant select on public.referral_public_links to anon, authenticated;

revoke all on function private.refresh_listing_public_stats(uuid) from public, anon, authenticated;
revoke all on function private.refresh_listing_public_stats_trigger() from public, anon, authenticated;
revoke all on function private.refresh_referral_public_link(uuid) from public, anon, authenticated;
revoke all on function private.refresh_referral_public_link_from_partnership() from public, anon, authenticated;
revoke all on function private.refresh_referral_public_links_from_listing() from public, anon, authenticated;
revoke all on function private.refresh_referral_public_links_from_image() from public, anon, authenticated;
