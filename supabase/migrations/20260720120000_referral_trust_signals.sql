-- ---------------------------------------------------------------------------
-- REFERRAL LANDING GÜVEN SİNYALLERİ (büyüme / dönüşüm)
-- Sosyalden gelen yabancı ziyaretçi için #1 dönüşüm bariyeri: "bu kime güveneceğim".
-- referral_public_links (anon-okunur snapshot TABLO) artık ortağın kimliği + satıcının
-- güven bandını taşır → landing (/i/[slug]) "X ortağı öneriyor · doğrulanmış · N satış"
-- + satıcı puanı gösterebilir. TABLO-seviyesi grant → yeni kolonlar anon'a otomatik görünür.
--
-- Doğrulanmış-satış: commission.partner_confirmed_paid_at IS NOT NULL (gerçekleşmiş, enum-bağımsız).
-- Güven rozeti: profiles.verified_identity/phone/instagram herhangi biri.
-- ---------------------------------------------------------------------------

alter table public.referral_public_links
  add column if not exists partner_name text,
  add column if not exists partner_verified boolean default false,
  add column if not exists partner_sales int default 0,
  add column if not exists seller_rating numeric,
  add column if not exists seller_verified boolean default false;

create or replace function private.refresh_referral_public_link(target_partnership_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
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
    ref_code, partnership_id, listing_id, slug, title, price,
    commission_type, commission_value, category, location, image_url,
    agreed_attribution_window_days,
    partner_name, partner_verified, partner_sales, seller_rating, seller_verified,
    updated_at
  )
  select
    p.ref_code, p.id, p.listing_id, l.slug, l.title, l.price,
    l.commission_type, l.commission_value, l.category, l.location,
    (select li.url from public.listing_images li where li.listing_id = l.id order by li.sort_order asc limit 1),
    coalesce(p.agreed_attribution_window_days, l.attribution_window_days, 30),
    pp.full_name,
    coalesce(pp.verified_identity, false) or coalesce(pp.verified_phone, false) or coalesce(pp.verified_instagram, false),
    coalesce((
      select count(*) from public.commissions c
      join public.partnerships p2 on p2.id = c.partnership_id
      where p2.partner_id = p.partner_id and c.partner_confirmed_paid_at is not null
    ), 0),
    sp.rating,
    coalesce(sp.verified_identity, false) or coalesce(sp.verified_phone, false) or coalesce(sp.verified_instagram, false),
    now()
  from public.partnerships p
  join public.listings l on l.id = p.listing_id
  left join public.profiles pp on pp.id = p.partner_id
  left join public.profiles sp on sp.id = l.owner_id
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
    agreed_attribution_window_days = excluded.agreed_attribution_window_days,
    partner_name = excluded.partner_name,
    partner_verified = excluded.partner_verified,
    partner_sales = excluded.partner_sales,
    seller_rating = excluded.seller_rating,
    seller_verified = excluded.seller_verified,
    updated_at = now();
end;
$function$;

-- Mevcut satırları geri-doldur (yoksa eski linkler güven bandını taşımaz).
update public.referral_public_links r
set partner_name = pp.full_name,
    partner_verified = coalesce(pp.verified_identity, false) or coalesce(pp.verified_phone, false) or coalesce(pp.verified_instagram, false),
    partner_sales = coalesce((
      select count(*) from public.commissions c
      join public.partnerships p2 on p2.id = c.partnership_id
      where p2.partner_id = p.partner_id and c.partner_confirmed_paid_at is not null
    ), 0),
    seller_rating = sp.rating,
    seller_verified = coalesce(sp.verified_identity, false) or coalesce(sp.verified_phone, false) or coalesce(sp.verified_instagram, false)
from public.partnerships p
join public.listings l on l.id = p.listing_id
left join public.profiles pp on pp.id = p.partner_id
left join public.profiles sp on sp.id = l.owner_id
where p.id = r.partnership_id;
