-- Kayıtlı XML ürün akışı (satıcı başına bir bağlantı) — otomatik fiyat/stok eşitlemesi için.
-- Eşitlemeyi `feed-sync` edge function yapar (pg_cron → pg_net ile yarım saatte bir tetiklenir; zamanlayıcı
-- kaydı gizli anahtar içerdiği için bu dosyada değil, scripts/deploy-feed-functions.py tarafından kurulur).
-- 2026-11-13'te canlıya uygulandı.

create table if not exists public.listing_feeds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  url text not null check (char_length(url) between 10 and 2000 and url ~* '^https?://'),
  enabled boolean not null default true,
  interval_hours integer not null default 6 check (interval_hours in (1, 3, 6, 12, 24)),
  pause_missing boolean not null default false,
  last_run_at timestamptz,
  next_run_at timestamptz not null default now(),
  last_status text check (last_status is null or last_status in ('ok', 'partial', 'error')),
  last_error text,
  last_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listing_feeds_due on public.listing_feeds (next_run_at) where enabled;

alter table public.listing_feeds enable row level security;

drop policy if exists "owner reads own feed" on public.listing_feeds;
create policy "owner reads own feed" on public.listing_feeds for select using (owner_id = (select auth.uid()));
drop policy if exists "owner creates own feed" on public.listing_feeds;
create policy "owner creates own feed" on public.listing_feeds for insert with check (owner_id = (select auth.uid()));
drop policy if exists "owner updates own feed" on public.listing_feeds;
create policy "owner updates own feed" on public.listing_feeds for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "owner deletes own feed" on public.listing_feeds;
create policy "owner deletes own feed" on public.listing_feeds for delete using (owner_id = (select auth.uid()));

-- Satıcı yalnız ayar sütunlarını yazabilir; çalışma sonuçlarını (last_*) yalnız sunucu yazar.
revoke all on public.listing_feeds from anon, authenticated;
grant select, delete on public.listing_feeds to authenticated;
grant insert (owner_id, url, enabled, interval_hours, pause_missing) on public.listing_feeds to authenticated;
grant update (url, enabled, interval_hours, pause_missing, next_run_at, updated_at) on public.listing_feeds to authenticated;
