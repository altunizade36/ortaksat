-- İLAN HUNİSİ: "ilan sayfasına gelen kişi neden satıcıya ulaşmıyor?" sorusunu ölçmek için günlük sayaçlar.
--
-- 2026-11-14 durumu: 466 görüntüleme kaydı, 0 talep. Görüntüleme tablosu yalnız "kaç kez açıldı"yı biliyordu;
-- ziyaretçinin NEREDEN geldiği, iletişim düğmesine BASIP BASMADIĞI ve giriş ekranına takılıp takılmadığı
-- bilinmiyordu. Bu tablo yalnız bunları sayar.
--
-- GİZLİLİK: satırda kişi, cihaz, IP ya da oturum kimliği YOKTUR — yalnız (gün, ilan, olay, kaynak, ortam) başına
-- bir sayı. Kişisel veri işlenmediği için çerez rızasına bağlı değildir (çerez/yerel kayıt da kullanmaz).
--
-- Sayaçlar herkesin çağırabildiği bir işlevle artar (girişsiz ziyaretçi de sayılmalı); bu yüzden kötüye
-- kullanıma açık bir ANALİTİK veridir: para, sıralama ya da herhangi bir karar buna bağlanmamalı.
create table if not exists public.listing_funnel_daily (
  day date not null default current_date,
  listing_id uuid not null references public.listings (id) on delete cascade,
  event text not null,
  source text not null default 'direct',
  platform text not null default 'web',
  n integer not null default 0,
  primary key (day, listing_id, event, source, platform)
);

alter table public.listing_funnel_daily enable row level security;
-- Politika YOK: tabloya doğrudan kimse erişemez; yazma track_listing_event, okuma listing_funnel_summary ile.
revoke all on public.listing_funnel_daily from anon, authenticated;

create or replace function public.track_listing_event(
  p_listing uuid,
  p_event text,
  p_source text default 'direct',
  p_platform text default 'web'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if p_listing is null
     or p_event not in ('view', 'contact_click', 'partner_click', 'offer_click', 'share', 'auth_wall')
     or p_source not in ('direct', 'internal', 'search', 'social', 'other', 'app')
     or p_platform not in ('web', 'mweb', 'ios', 'android') then
    return;
  end if;
  select owner_id into v_owner from public.listings where id = p_listing and status = 'active' and coalesce(demo, false) = false;
  if v_owner is null or v_owner = auth.uid() then
    return; -- yayında olmayan / tanıtım ilanı ya da ilan sahibinin kendi ziyareti sayılmaz
  end if;
  insert into public.listing_funnel_daily as f (day, listing_id, event, source, platform, n)
  values (current_date, p_listing, p_event, p_source, p_platform, 1)
  on conflict (day, listing_id, event, source, platform)
  do update set n = f.n + 1 where f.n < 1000000;
end;
$$;

revoke all on function public.track_listing_event(uuid, text, text, text) from public;
grant execute on function public.track_listing_event(uuid, text, text, text) to anon, authenticated;

-- Yönetici özeti: son p_days günün olay × kaynak × ortam toplamları + en çok görüntülenen ilanlar.
create or replace function public.listing_funnel_summary(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from date := current_date - greatest(1, least(coalesce(p_days, 30), 365)) + 1;
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'Yetkisiz.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'from', v_from,
    'totals', coalesce((select jsonb_object_agg(event, total) from (
        select event, sum(n)::int as total from public.listing_funnel_daily where day >= v_from group by event) t), '{}'::jsonb),
    'by_source', coalesce((select jsonb_agg(row_to_json(s)) from (
        select source, platform,
               sum(n) filter (where event = 'view')::int as views,
               sum(n) filter (where event in ('contact_click', 'partner_click', 'offer_click'))::int as clicks,
               sum(n) filter (where event = 'auth_wall')::int as auth_walls
          from public.listing_funnel_daily where day >= v_from group by source, platform order by 3 desc nulls last) s), '[]'::jsonb),
    'top_listings', coalesce((select jsonb_agg(row_to_json(l)) from (
        select f.listing_id, max(li.title) as title,
               sum(f.n) filter (where f.event = 'view')::int as views,
               sum(f.n) filter (where f.event in ('contact_click', 'partner_click', 'offer_click'))::int as clicks,
               sum(f.n) filter (where f.event = 'auth_wall')::int as auth_walls
          from public.listing_funnel_daily f join public.listings li on li.id = f.listing_id
         where f.day >= v_from group by f.listing_id order by 3 desc nulls last limit 10) l), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.listing_funnel_summary(integer) from public, anon;
grant execute on function public.listing_funnel_summary(integer) to authenticated;
