-- Y6 — GÖRÜNTÜLENME SAYACI SİSTEMİ
-- Sistemde görüntülenme sayacı YOKTU (denetim). Bu; ilan sosyal-kanıtı, "en çok görüntülenen"
-- sıralaması ve ilan/ortak performans istatistiklerinin kilididir. Mevcut mimariye oturur:
-- listing_public_stats (partner_count/lead_count/favorite_count/review_count tutan agregat tablo)
-- ve listing_public_cards (ondan okuyan security_invoker view).

-- 1) Agregat stats tablosuna görüntülenme sayacı.
alter table public.listing_public_stats add column if not exists view_count bigint not null default 0;

-- 2) Şişirme-önleyici dedup tablosu: bir izleyici (viewer_key) bir ilanı GÜNDE BİR kez sayar.
create table if not exists public.listing_views (
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer_key text not null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (listing_id, viewer_key, viewed_on)
);
alter table public.listing_views enable row level security;
-- Yazım YALNIZ SECURITY DEFINER RPC üzerinden; doğrudan okuma/yazma kapalı (public sayım view_count'tan gelir).
revoke all on public.listing_views from anon, authenticated;

-- 3) Görüntülenme kaydı RPC — owner-hariç, günlük-dedup, kurcalanmaya dirençli.
create or replace function public.record_listing_view(p_listing_id uuid, p_viewer_key text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_owner uuid;
  v_cnt int;
begin
  if p_listing_id is null or p_viewer_key is null or length(btrim(p_viewer_key)) = 0 then
    return;
  end if;
  select owner_id into v_owner
    from public.listings
   where id = p_listing_id and status = 'active' and deleted_at is null;
  if v_owner is null then
    return;  -- ilan yok / pasif
  end if;
  if auth.uid() is not null and auth.uid() = v_owner then
    return;  -- satıcı kendi ilanını sayamaz
  end if;
  insert into public.listing_views (listing_id, viewer_key, viewed_on)
    values (p_listing_id, left(btrim(p_viewer_key), 64), current_date)
    on conflict do nothing;
  get diagnostics v_cnt = row_count;
  if v_cnt = 1 then  -- bugün ilk kez → sayacı artır
    insert into public.listing_public_stats (listing_id, view_count)
      values (p_listing_id, 1)
      on conflict (listing_id) do update
        set view_count = public.listing_public_stats.view_count + 1, updated_at = now();
  end if;
end
$fn$;
grant execute on function public.record_listing_view(uuid, text) to anon, authenticated;

-- 4) Public view'a view_count kolonu (mevcut kolonlar aynı sırada + yeni kolon SONA → CREATE OR
--    REPLACE geçerli; grant + security_invoker korunur). Tam tanım koruma altında.
create or replace view public.listing_public_cards with (security_invoker = true) as
 select l.id,
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
    ( select li.url
           from listing_images li
          where li.listing_id = l.id
          order by li.sort_order
         limit 1) as image_url,
    coalesce(s.partner_count, 0::bigint) as partner_count,
    coalesce(s.lead_count, 0::bigint) as lead_count,
    coalesce(s.favorite_count, 0::bigint) as favorite_count,
    coalesce(s.review_count, 0::bigint) as review_count,
    l.featured,
    l.currency,
    l.demo,
    l.bonus_amount,
    l.bonus_quota,
    l.attributes,
    l.province_id,
    l.district_id,
    l.neighborhood_id,
        case
            when l.commission_type = 'rate'::text then round(l.price * l.commission_value / 100.0)
            else l.commission_value
        end as commission_tl,
    l.commission_tiers,
    l.attribution_window_days,
    coalesce(s.view_count, 0::bigint) as view_count
   from listings l
     left join listing_public_stats s on s.listing_id = l.id;

-- KRİTİK ([[anon-column-grant-gotcha]]): view yeniden yaratılınca SELECT grant'ı güvenceye al,
-- yoksa anon 401 → tüm keşfet boşalır.
grant select on public.listing_public_cards to anon, authenticated;
