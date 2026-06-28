create extension if not exists pgcrypto;

create type public.listing_status as enum ('draft', 'active', 'paused', 'sold', 'rejected');
create type public.partnership_mode as enum ('open', 'approval', 'invite');
create type public.partnership_status as enum ('active', 'pending', 'rejected', 'blocked');
create type public.lead_status as enum ('new', 'contacted', 'converted', 'lost');
create type public.lead_source as enum ('whatsapp', 'instagram', 'web', 'phone');
create type public.purchase_intent as enum ('hot', 'warm', 'cold');
create type public.order_status as enum ('pending', 'confirmed', 'delivered', 'cancelled');
create type public.commission_status as enum ('pending', 'approved', 'paid');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  bio text default '',
  verified_phone boolean not null default false,
  verified_identity boolean not null default false,
  rating numeric(2,1) not null default 0,
  response_rate integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text not null,
  price numeric(12,2) not null check (price > 0),
  commission_type text not null check (commission_type in ('rate', 'fixed')),
  commission_value numeric(12,2) not null check (commission_value >= 0),
  category text not null,
  location text not null,
  status public.listing_status not null default 'draft',
  partnership_mode public.partnership_mode not null default 'approval',
  stock_count integer not null default 0 check (stock_count >= 0),
  min_partner_rating numeric(2,1) not null default 0,
  commission_due_days integer not null default 3 check (commission_due_days >= 0),
  return_window_days integer not null default 0 check (return_window_days >= 0),
  partner_rules text[] not null default '{}',
  delivery_note text not null default '',
  contact_method text not null default 'message' check (contact_method in ('whatsapp', 'phone', 'message')),
  sales_pitch text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0
);

create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  ref_code text not null unique,
  status public.partnership_status not null default 'pending',
  note text not null default '',
  rejection_reason text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, partner_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  partnership_id uuid not null references public.partnerships(id) on delete cascade,
  buyer_name text not null,
  buyer_phone text not null,
  note text not null default '',
  source public.lead_source not null default 'web',
  intent public.purchase_intent not null default 'warm',
  status public.lead_status not null default 'new',
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  buyer_id uuid references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  partnership_id uuid references public.partnerships(id),
  amount numeric(12,2) not null check (amount > 0),
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  listing_id uuid not null references public.listings(id),
  partnership_id uuid not null references public.partnerships(id),
  amount numeric(12,2) not null check (amount >= 0),
  status public.commission_status not null default 'pending',
  approved_at timestamptz,
  paid_at timestamptz,
  payout_note text,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now()
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.partnerships enable row level security;
alter table public.leads enable row level security;
alter table public.orders enable row level security;
alter table public.commissions enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "active listings are readable" on public.listings for select using (status = 'active' or owner_id = auth.uid());
create policy "owners manage listings" on public.listings for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "listing images readable" on public.listing_images for select using (true);
create policy "owners manage listing images" on public.listing_images for all using (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
) with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);

create policy "partners and owners read partnerships" on public.partnerships for select using (
  partner_id = auth.uid() or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);
create policy "users apply as partner" on public.partnerships for insert with check (partner_id = auth.uid());
create policy "listing owners update partnerships" on public.partnerships for update using (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
) with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);

create policy "lead owners and partners read leads" on public.leads for select using (
  exists (
    select 1 from public.partnerships p
    join public.listings l on l.id = p.listing_id
    where p.id = partnership_id and (p.partner_id = auth.uid() or l.owner_id = auth.uid())
  )
);
create policy "partners create leads" on public.leads for insert with check (
  exists (select 1 from public.partnerships p where p.id = partnership_id and p.partner_id = auth.uid() and p.status = 'active')
);
create policy "listing owners update leads" on public.leads for update using (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
) with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);

create policy "order participants read orders" on public.orders for select using (
  buyer_id = auth.uid() or seller_id = auth.uid() or exists (select 1 from public.partnerships p where p.id = partnership_id and p.partner_id = auth.uid())
);
create policy "seller creates orders" on public.orders for insert with check (seller_id = auth.uid());
create policy "seller updates orders" on public.orders for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());

create policy "commission participants read" on public.commissions for select using (
  exists (
    select 1 from public.partnerships p
    join public.listings l on l.id = p.listing_id
    where p.id = partnership_id and (p.partner_id = auth.uid() or l.owner_id = auth.uid())
  )
);
create policy "listing owner manages commissions" on public.commissions for all using (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
) with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);

create policy "reviews readable" on public.reviews for select using (true);
create policy "users create reviews" on public.reviews for insert with check (reviewer_id = auth.uid());

create policy "users read own favorites" on public.favorites for select using (user_id = auth.uid());
create policy "users manage own favorites" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "message participants read" on public.messages for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "users send messages" on public.messages for insert with check (sender_id = auth.uid());
create policy "receiver marks messages read" on public.messages for update using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());

create policy "users read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public listing images readable" on storage.objects for select using (bucket_id = 'listing-images');
create policy "users upload listing images" on storage.objects for insert with check (
  bucket_id = 'listing-images' and auth.role() = 'authenticated' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "users update own listing images" on storage.objects for update using (
  bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]
) with check (
  bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "users delete own listing images" on storage.objects for delete using (
  bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]
);

create view public.listing_public_cards
with (security_invoker = true) as
select
  l.id,
  l.owner_id,
  l.title,
  l.slug,
  l.description,
  l.sales_pitch,
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

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.listings, public.listing_images, public.reviews, public.listing_public_cards to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.listings, public.listing_images to authenticated;
grant select, insert, update on public.partnerships, public.leads, public.orders, public.commissions, public.messages, public.notifications to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant insert on public.reviews to authenticated;

create index listings_owner_idx on public.listings(owner_id);
create index listings_status_idx on public.listings(status);
create index partnerships_listing_idx on public.partnerships(listing_id);
create index partnerships_partner_idx on public.partnerships(partner_id);
create index leads_partnership_idx on public.leads(partnership_id);
create index messages_receiver_idx on public.messages(receiver_id);
create index notifications_user_idx on public.notifications(user_id);
