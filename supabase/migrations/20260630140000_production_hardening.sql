-- OrtakSat — Production hardening migration
-- Idempotent. Safe to re-run. Paste into Supabase SQL Editor or apply via `supabase db push`.
-- Adds: status expansions, missing indexes, soft-delete, activity log, rate limits,
-- prohibited keyword moderation, extended roles. No data is destroyed.

-- =====================================================================
-- 1) STATUS EXPANSIONS (idempotent enum value adds)
-- NOTE: `ALTER TYPE ... ADD VALUE` may not run inside a DO/plpgsql block,
-- so these are top-level statements with IF NOT EXISTS (PG 12+).
-- =====================================================================
alter type public.listing_status     add value if not exists 'pending_review';
alter type public.listing_status     add value if not exists 'expired';
alter type public.partnership_status add value if not exists 'cancelled';
alter type public.partnership_status add value if not exists 'completed';

-- =====================================================================
-- 2) EXTENDED ROLES (seller / partner / super_admin)
--    profiles.role is a CHECK-constrained text. Widen the allowed set.
-- =====================================================================
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') then
    alter table public.profiles drop constraint if exists profiles_role_check;
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('user', 'seller', 'partner', 'moderator', 'admin', 'super_admin'));
  end if;
end$$;

-- is_admin() should treat super_admin as admin too (recreate, keep STABLE + search_path)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('moderator', 'admin', 'super_admin')
      and status = 'active'
  );
$$;

-- =====================================================================
-- 3) MISSING INDEXES (high-traffic filter/sort columns)
-- =====================================================================
create index if not exists listings_category_idx       on public.listings(category);
create index if not exists listings_price_idx           on public.listings(price);
create index if not exists listings_created_at_idx      on public.listings(created_at desc);
create index if not exists listings_status_created_idx  on public.listings(status, created_at desc);
create index if not exists listings_neighborhood_idx    on public.listings(neighborhood_id);
create index if not exists commissions_created_at_idx   on public.commissions(created_at desc);
create index if not exists commissions_status_idx       on public.commissions(status);
create index if not exists commissions_partnership_idx  on public.commissions(partnership_id);
create index if not exists orders_status_idx            on public.orders(status);
create index if not exists orders_seller_idx            on public.orders(seller_id);
create index if not exists partnerships_status_idx      on public.partnerships(status);
create index if not exists favorites_user_idx           on public.favorites(user_id);
create index if not exists favorites_listing_idx        on public.favorites(listing_id);
create index if not exists notifications_user_read_idx  on public.notifications(user_id, read, created_at desc);
create index if not exists reviews_listing_idx          on public.reviews(listing_id);
create index if not exists messages_sender_idx          on public.messages(sender_id);

-- =====================================================================
-- 4) SOFT DELETE (deleted_at) on critical tables + filtered RLS reads
-- =====================================================================
alter table public.listings     add column if not exists deleted_at timestamptz;
alter table public.partnerships add column if not exists deleted_at timestamptz;
alter table public.messages     add column if not exists deleted_at timestamptz;
alter table public.commissions  add column if not exists deleted_at timestamptz;
alter table public.reviews      add column if not exists deleted_at timestamptz;

create index if not exists listings_not_deleted_idx on public.listings(status) where deleted_at is null;

-- Replace the public listing read policy so soft-deleted rows disappear for everyone but the owner/admin.
drop policy if exists "active listings are readable" on public.listings;
create policy "active listings are readable" on public.listings
  for select using (
    (deleted_at is null and status = 'active')
    or owner_id = auth.uid()
    or public.is_admin()
  );

-- NOT: listing_public_cards view'ı `security_invoker = true` ile çalışır; yani
-- sorgulayan kullanıcının RLS'ine tabidir. Yukarıda "active listings are readable"
-- politikasını `deleted_at is null` ile güncellediğimiz için, view soft-deleted
-- ilanları otomatik gizler. View'ı yeniden oluşturmaya gerek yoktur
-- (CREATE OR REPLACE kolon kümesini değiştiremez ve gereksizdir).

-- =====================================================================
-- 5) ACTIVITY / AUDIT LOG
-- =====================================================================
create table if not exists public.activity_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  ip_address  text,
  user_agent  text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_logs_user_idx    on public.activity_logs(user_id, created_at desc);
create index if not exists activity_logs_action_idx  on public.activity_logs(action, created_at desc);
create index if not exists activity_logs_entity_idx  on public.activity_logs(entity_type, entity_id);

alter table public.activity_logs enable row level security;
drop policy if exists "users insert own activity" on public.activity_logs;
create policy "users insert own activity" on public.activity_logs
  for insert with check (user_id = auth.uid() or user_id is null);
drop policy if exists "admins read activity" on public.activity_logs;
create policy "admins read activity" on public.activity_logs
  for select using (public.is_admin());
grant insert on public.activity_logs to anon, authenticated;
grant select on public.activity_logs to authenticated;

-- =====================================================================
-- 6) RATE LIMITS (server-enforced counter, callable from client)
-- =====================================================================
create table if not exists public.rate_limits (
  id          bigint generated always as identity primary key,
  bucket_key  text not null,          -- e.g. 'listing_create:<uid>' or 'message_send:<uid>'
  action      text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists rate_limits_bucket_idx on public.rate_limits(bucket_key, occurred_at desc);

alter table public.rate_limits enable row level security;
-- No direct table access; only the SECURITY DEFINER function below may touch it.
revoke all on public.rate_limits from anon, authenticated;

-- check_rate_limit: returns true if the action is ALLOWED (under the limit), and records it.
-- Window in seconds, max_count attempts per window per bucket.
create or replace function public.check_rate_limit(
  p_action text,
  p_max_count integer default 10,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_count integer;
begin
  -- Bucket by authenticated user when present, else by action only (best-effort; real IP limiting is at the edge).
  v_key := p_action || ':' || coalesce(auth.uid()::text, 'anon');

  delete from public.rate_limits
   where occurred_at < now() - make_interval(secs => greatest(p_window_seconds, 1) * 4);

  select count(*) into v_count
    from public.rate_limits
   where bucket_key = v_key
     and occurred_at > now() - make_interval(secs => greatest(p_window_seconds, 1));

  if v_count >= greatest(p_max_count, 1) then
    return false;
  end if;

  insert into public.rate_limits(bucket_key, action) values (v_key, p_action);
  return true;
end;
$$;
revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;

-- =====================================================================
-- 7) PROHIBITED KEYWORD MODERATION
-- =====================================================================
create table if not exists public.prohibited_keywords (
  id         bigint generated always as identity primary key,
  keyword    text not null unique,
  category   text not null default 'other',  -- weapon/drug/counterfeit/adult/document/...
  severity   text not null default 'review' check (severity in ('review', 'block')),
  created_at timestamptz not null default now()
);
alter table public.prohibited_keywords enable row level security;
drop policy if exists "anyone reads prohibited keywords" on public.prohibited_keywords;
create policy "anyone reads prohibited keywords" on public.prohibited_keywords
  for select using (true);
drop policy if exists "admins manage prohibited keywords" on public.prohibited_keywords;
create policy "admins manage prohibited keywords" on public.prohibited_keywords
  for all using (public.is_admin()) with check (public.is_admin());
grant select on public.prohibited_keywords to anon, authenticated;

insert into public.prohibited_keywords(keyword, category, severity) values
  ('silah','weapon','block'),('tabanca','weapon','block'),('tüfek','weapon','block'),
  ('mermi','weapon','block'),('fişek','weapon','review'),('bıçak','weapon','review'),
  ('uyuşturucu','drug','block'),('esrar','drug','block'),('eroin','drug','block'),
  ('kokain','drug','block'),('bonzai','drug','block'),('hap','drug','review'),
  ('reçeteli','drug','review'),('ilaç','drug','review'),
  ('sahte','counterfeit','review'),('replika','counterfeit','review'),('taklit','counterfeit','review'),
  ('birinci kalite replika','counterfeit','block'),('a kalite','counterfeit','review'),
  ('çalıntı','stolen','block'),('kaçak','stolen','review'),
  ('kumar','gambling','block'),('bahis','gambling','review'),('iddaa','gambling','review'),
  ('yetişkin','adult','review'),('porno','adult','block'),('escort','adult','block'),
  ('kimlik','document','review'),('pasaport','document','block'),('ehliyet','document','block'),
  ('diploma','document','review'),('nüfus cüzdanı','document','block'),
  ('organ','other','block'),('böbrek','other','block')
on conflict (keyword) do nothing;

-- moderation helper: returns the worst severity matched ('block' > 'review' > 'none')
create or replace function public.scan_prohibited(p_text text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when bool_or(severity = 'block') then 'block'
                 when bool_or(severity = 'review') then 'review'
                 else 'none' end
       from public.prohibited_keywords
      where position(lower(keyword) in lower(coalesce(p_text, ''))) > 0),
    'none');
$$;
revoke all on function public.scan_prohibited(text) from public;
grant execute on function public.scan_prohibited(text) to anon, authenticated;

-- =====================================================================
-- 8) Add to realtime (activity is admin-only; keep notifications realtime)
-- =====================================================================
-- (notifications already in supabase_realtime publication from earlier migration)
