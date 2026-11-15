-- Ortaklık davetleri: gelen/giden davet listesi + "ilgilenmiyorum" (2026-11-16).
--
-- 20261115150000 ile satıcı bir ortağı ilanına davet edebiliyordu; ama davet YALNIZ bildirimde görünüyordu:
-- ortak bildirimi kaçırırsa daveti bir daha bulamıyor, satıcı da gönderdiği davetin ne olduğunu göremiyordu.
--
-- 1) `my_partnership_invites()` — çağıranın GELEN (ortak olarak) ve GİDEN (satıcı olarak) davetleri, ilan özeti ve
--    karşı tarafın adıyla. Durum sunucuda hesaplanır:
--      active    → bu ilanda ortaklık kurulmuş
--      applied   → ortak başvurmuş, satıcının kararı bekleniyor
--      dismissed → ortak "ilgilenmiyorum" demiş
--      closed    → ilan artık yayında değil ya da ortaklığa kapalı
--      pending   → davet yanıt bekliyor
--    Engelleşmiş taraflar arasındaki davetler listelenmez. Son 90 gün, en çok 60 kayıt.
-- 2) `dismiss_partnership_invite(p_invite)` — yalnız davet edilen ortak kendi davetini kapatır. Satıcıya bildirim
--    GİTMEZ (ret bildirimi gereksiz gürültü); satıcı durumu giden davetler listesinde görür.
--
-- Tabloya istemci yazamaz (yalnız okuma izni var); iki işlev de SECURITY DEFINER.

alter table public.partnership_invites add column if not exists dismissed_at timestamptz;

create or replace function public.my_partnership_invites()
returns table (
  id uuid,
  direction text,
  state text,
  created_at timestamptz,
  listing_id uuid,
  listing_title text,
  listing_image text,
  price numeric,
  currency text,
  commission_amount numeric,
  other_id uuid,
  other_name text,
  other_avatar text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    i.id,
    case when i.partner_id = auth.uid() then 'received' else 'sent' end as direction,
    case
      when exists (select 1 from public.partnerships p
                    where p.listing_id = i.listing_id and p.partner_id = i.partner_id
                      and p.deleted_at is null and p.status::text = 'active') then 'active'
      when exists (select 1 from public.partnerships p
                    where p.listing_id = i.listing_id and p.partner_id = i.partner_id
                      and p.deleted_at is null and p.status::text = 'pending') then 'applied'
      when i.dismissed_at is not null then 'dismissed'
      when l.status::text <> 'active' or coalesce(l.partnership_mode::text, 'none') = 'none' then 'closed'
      else 'pending'
    end as state,
    i.created_at,
    l.id as listing_id,
    private.display_listing_title(l.title) as listing_title,
    (select li.url from public.listing_images li where li.listing_id = l.id order by li.sort_order limit 1) as listing_image,
    l.price,
    l.currency,
    case when l.commission_type = 'rate' then round(l.price * l.commission_value / 100.0) else l.commission_value end as commission_amount,
    o.id as other_id,
    coalesce(nullif(trim(o.full_name), ''), 'OrtakSat kullanıcısı') as other_name,
    o.avatar_url as other_avatar
  from public.partnership_invites i
  join public.listings l on l.id = i.listing_id
  join public.profiles o on o.id = case when i.partner_id = auth.uid() then i.seller_id else i.partner_id end
  where (i.partner_id = auth.uid() or i.seller_id = auth.uid())
    and i.created_at > now() - interval '90 days'
    and not exists (select 1 from public.blocked_users b
                     where (b.blocker_id = i.seller_id and b.blocked_id = i.partner_id)
                        or (b.blocker_id = i.partner_id and b.blocked_id = i.seller_id))
  order by i.created_at desc
  limit 60;
$function$;
revoke all on function public.my_partnership_invites() from public, anon;
grant execute on function public.my_partnership_invites() to authenticated;

create or replace function public.dismiss_partnership_invite(p_invite uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_done uuid;
begin
  if v_me is null then raise exception 'Bu işlem için giriş yapmalısın.'; end if;
  update public.partnership_invites
     set dismissed_at = now()
   where id = p_invite and partner_id = v_me and dismissed_at is null
  returning id into v_done;
  return v_done is not null;
end;
$function$;
revoke all on function public.dismiss_partnership_invite(uuid) from public, anon;
grant execute on function public.dismiss_partnership_invite(uuid) to authenticated;

notify pgrst, 'reload schema';
