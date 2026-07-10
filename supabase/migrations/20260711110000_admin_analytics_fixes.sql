-- Admin analitik: review düzeltmeleri (perf + doğru GMV + reprodüksiyon + tz + grant).
-- 1) Şema reprodüksiyonu (idempotent): presence altyapısı hiçbir committed migration'da yoktu.
alter table public.profiles add column if not exists last_seen_at timestamptz;
create table if not exists public.user_active_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  primary key (user_id, day)
);
alter table public.user_active_days enable row level security;
create index if not exists idx_user_active_days_day on public.user_active_days(day);
create index if not exists idx_profiles_last_seen on public.profiles(last_seen_at);
create index if not exists idx_listings_created_at2 on public.listings(created_at);
create or replace function public.heartbeat()
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles set last_seen_at = now() where id = auth.uid();
  insert into public.user_active_days(user_id, day) values (auth.uid(), current_date) on conflict (user_id, day) do nothing;
end; $$;
revoke all on function public.heartbeat() from public;
grant execute on function public.heartbeat() to authenticated;

-- 2) admin_live_analytics: sargable 14-gün trend (28 tam-tarama → 3 aralık-taraması) +
--    GERÇEK GMV=sum(orders.amount) ayrı komisyon toplamı + Istanbul tz + grant hijyeni.
create or replace function public.admin_live_analytics()
returns json language plpgsql security definer
set search_path to 'public', 'auth'
set timezone to 'Europe/Istanbul'
as $$
declare is_admin boolean; result json;
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into is_admin from public.profiles where id = auth.uid();
  if not coalesce(is_admin, false) then raise exception 'not authorized'; end if;
  select json_build_object(
    'total_users', (select count(*) from auth.users),
    'confirmed_users', (select count(*) from auth.users where email_confirmed_at is not null),
    'live_now', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
    'active_today', (select count(*) from public.user_active_days where day = current_date),
    'new_today', (select count(*) from auth.users where created_at >= date_trunc('day', now())),
    'new_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'listings_total', (select count(*) from public.listings),
    'listings_active', (select count(*) from public.listings where status='active'),
    'listings_pending', (select count(*) from public.listings where status='pending_review'),
    'listings_paused', (select count(*) from public.listings where status='paused'),
    'listings_sold', (select count(*) from public.listings where status='sold'),
    'listings_new_7d', (select count(*) from public.listings where created_at >= now() - interval '7 days'),
    'commissions_total', (select count(*) from public.commissions),
    'commissions_paid', (select count(*) from public.commissions where status='paid'),
    -- GERÇEK GMV = satış/ürün değeri (orders.amount). commissions.amount komisyon KESİNTİSİdir, GMV değil.
    'gmv', (select coalesce(sum(amount),0) from public.orders),
    'commission_amount', (select coalesce(sum(amount),0) from public.commissions),
    'commission_paid_amount', (select coalesce(sum(amount) filter (where status='paid'),0) from public.commissions),
    'partnerships_total', (select count(*) from public.partnerships),
    'partnerships_active', (select count(*) from public.partnerships where status='active'),
    'partnerships_pending', (select count(*) from public.partnerships where status='pending'),
    'orders_total', (select count(*) from public.orders),
    'open_reports', (select count(*) from public.reports where status in ('open','reviewing')),
    'cat_suggestions', (select count(*) from public.category_suggestions where status='pending'),
    'loc_suggestions', (select count(*) from public.location_suggestions where status='pending'),
    'days', (
      select json_agg(json_build_object('day', s.day, 'active', coalesce(ac.n,0), 'signups', coalesce(su.n,0), 'listings', coalesce(li.n,0)) order by s.day)
      from (select (current_date - 13 + i)::date as day from generate_series(0,13) i) s
      left join (select created_at::date d, count(*) n from auth.users where created_at >= current_date - 13 group by 1) su on su.d = s.day
      left join (select created_at::date d, count(*) n from public.listings where created_at >= current_date - 13 group by 1) li on li.d = s.day
      left join (select day, count(*) n from public.user_active_days where day >= current_date - 13 group by day) ac on ac.day = s.day
    ),
    'top_categories', (select json_agg(json_build_object('category', category, 'n', n) order by n desc) from (
        select category, count(*) as n from public.listings where status='active' group by category order by count(*) desc limit 8) c)
  ) into result;
  return result;
end; $$;
revoke all on function public.admin_live_analytics() from public;
grant execute on function public.admin_live_analytics() to authenticated;
