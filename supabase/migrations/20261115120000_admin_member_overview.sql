-- Yönetim paneli: üyelik ve çevrim içi görünümü (2026-11-15).
--
-- İstek: "üyeleri en sondan ilke üyelik tarihiyle sıralı görelim, anlık kim çevrim içi / kim içeride bilelim".
-- Eksik olan: panel üyelik tarihini biliyordu ama son görülme, e-posta, giriş yöntemi ve "şu an kim içeride"
-- bilgisi hiçbir sorgudan gelmiyordu; çevrim içi sinyali (heartbeat) hangi ortamdan geldiğini kaydetmiyordu.
--
-- 1) user_presence: kullanıcının son sinyali ve ortamı (web / ios / android). profiles'a sütun EKLENMEDİ:
--    profiles satırlarını başka üyeler de okuyabiliyor; "hangi cihazdan girdi" bilgisi yalnız yönetime açık olmalı.
--    Tabloda RLS açık ve hiçbir politika yok → istemciler okuyamaz/yazamaz; yalnız aşağıdaki işlevler erişir.
-- 2) heartbeat(p_platform): eski parametresiz sürümün yerini alır (parametre varsayılanlı olduğu için eski
--    istemcilerin parametresiz çağrısı çalışmaya devam eder). İki ayrı sürüm bırakılmaz: PostgREST hangisini
--    çağıracağını seçemez.
-- 3) admin_member_overview(): yönetici korumalı tek sorgu — sayaçlar, şu an içeridekiler, 30 günlük seri,
--    giriş yöntemleri ve üye bazında ek bilgi (üye sırası, e-posta, giriş yöntemi, son görülme, son giriş).

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  platform text
);
alter table public.user_presence enable row level security;
revoke all on public.user_presence from anon, authenticated;

drop function if exists public.heartbeat();
create or replace function public.heartbeat(p_platform text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_platform text := case when p_platform in ('web', 'ios', 'android') then p_platform else null end;
begin
  if auth.uid() is null then return; end if;
  update public.profiles set last_seen_at = now() where id = auth.uid();
  insert into public.user_active_days(user_id, day) values (auth.uid(), current_date) on conflict (user_id, day) do nothing;
  insert into public.user_presence(user_id, last_seen_at, platform) values (auth.uid(), now(), v_platform)
  on conflict (user_id) do update
    set last_seen_at = excluded.last_seen_at,
        platform = coalesce(excluded.platform, public.user_presence.platform);
end;
$function$;
revoke all on function public.heartbeat(text) from public, anon;
grant execute on function public.heartbeat(text) to authenticated, service_role;

create or replace function public.admin_member_overview()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v jsonb;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'now', now(),
    'total', (select count(*) from public.profiles where coalesce(status::text, 'active') <> 'deleted'),
    -- "çevrim içi" eşiği admin_live_analytics.live_now ile aynı: son 5 dakika (istemci 60 sn'de bir sinyal yollar)
    'online_now', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
    'active_1h', (select count(*) from public.profiles where last_seen_at > now() - interval '1 hour'),
    'active_today', (select count(*) from public.profiles where (last_seen_at at time zone 'Europe/Istanbul')::date = v_today),
    'joined_today', (select count(*) from public.profiles where (created_at at time zone 'Europe/Istanbul')::date = v_today),
    'joined_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'joined_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'online', coalesce((select jsonb_agg(to_jsonb(x) order by x.last_seen_at desc) from (
        select p.id, p.full_name as name, p.last_seen_at, up.platform
        from public.profiles p
        left join public.user_presence up on up.user_id = p.id
        where p.last_seen_at > now() - interval '15 minutes'
        order by p.last_seen_at desc limit 100) x), '[]'::jsonb),
    'days', (select jsonb_agg(jsonb_build_object(
        'day', d::date,
        'signups', (select count(*) from public.profiles where (created_at at time zone 'Europe/Istanbul')::date = d::date),
        'active', (select count(*) from public.user_active_days where day = d::date)) order by d)
      from generate_series(v_today - 29, v_today, interval '1 day') d),
    'providers', coalesce((select jsonb_agg(jsonb_build_object('provider', s.provider, 'count', s.c) order by s.c desc) from (
        select coalesce(raw_app_meta_data->>'provider', 'email') as provider, count(*) as c from auth.users group by 1) s), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(m)) from (
        select p.id,
               row_number() over (order by p.created_at asc nulls last, p.id) as no,
               u.email,
               coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
               p.created_at, p.last_seen_at, u.last_sign_in_at, up.platform,
               (select count(*) from public.listings l where l.owner_id = p.id) as listing_count,
               (select count(*) from public.listings l where l.owner_id = p.id and l.status::text = 'active') as active_listing_count,
               (select count(*) from public.partnerships pt where pt.partner_id = p.id) as partnership_count
        from public.profiles p
        left join auth.users u on u.id = p.id
        left join public.user_presence up on up.user_id = p.id
        order by p.created_at desc nulls last
        limit 2000) m), '[]'::jsonb)
  ) into v;
  return v;
end;
$function$;
revoke all on function public.admin_member_overview() from public, anon;
grant execute on function public.admin_member_overview() to authenticated, service_role;

notify pgrst, 'reload schema';
