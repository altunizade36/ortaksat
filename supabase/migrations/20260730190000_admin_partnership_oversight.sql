-- ADMIN ORTAKLIK GÖZETİMİ — admin panelindeki "Ortak Satış Talepleri" bölümü BOZUKTU:
-- başlık "N toplam (sunucu)" diyordu ama liste BOŞTU. Sebep: partnerships RLS'inde
-- admin bypass'ı yok (SELECT: partner/ilan-sahibi; UPDATE: yalnız ilan-sahibi) + client
-- sorgusu kullanıcı-filtreli → admin yalnız KENDİ ortaklıklarını görüyordu, platform-geneli
-- ortaklıkları ne görebiliyor ne yönetebiliyordu. İki SECURITY DEFINER admin RPC ekler.

-- 1) LİSTE (salt-okunur): tüm ortaklıklar + ilan/sahip/ortak/durum/komisyon/tarih.
create or replace function public.admin_list_partnerships()
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_is_admin boolean; result json;
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then raise exception 'not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'id', pt.id,
    'listingId', pt.listing_id,
    'listingTitle', l.title,
    'ownerId', l.owner_id,
    'ownerName', op.full_name,
    'partnerId', pt.partner_id,
    'partnerName', pp.full_name,
    'status', pt.status,
    'commissionType', l.commission_type,
    'commissionValue', l.commission_value,
    'currency', l.currency,
    'createdAt', pt.created_at
  ) order by (pt.status = 'pending') desc, pt.created_at desc), '[]'::json)
  into result
  from public.partnerships pt
  left join public.listings l on l.id = pt.listing_id
  left join public.profiles op on op.id = l.owner_id
  left join public.profiles pp on pp.id = pt.partner_id
  where pt.deleted_at is null;
  return result;
end; $$;

-- 2) DURUM DEĞİŞTİR: admin herhangi bir ortaklığı onaylar/reddeder/sonlandırır.
-- enforce_partnership_approval trigger'ı 'active'i pending'e çevirir (approval/invite modu)
-- AMA app.trusted_join='1' GUC'siyle bypass edilir (doğrulanmış-RPC yolu) → admin onayı geçer.
-- Diğer trigger'lar (stats/referral-link/audit) UPDATE'te otomatik çalışır.
create or replace function public.admin_set_partnership_status(p_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_is_admin boolean;
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then raise exception 'not authorized'; end if;
  if p_status not in ('active','rejected','cancelled','blocked') then raise exception 'invalid status'; end if;
  perform set_config('app.trusted_join', '1', true);
  update public.partnerships
    set status = p_status::partnership_status,
        approved_at = case when p_status = 'active' then now() else approved_at end,
        rejection_reason = case when p_status = 'rejected' then coalesce(nullif(p_reason, ''), 'Yönetici tarafından reddedildi.') else rejection_reason end
    where id = p_id and deleted_at is null;
end; $$;

-- Grant: admin_* deseni — public/anon'dan revoke, yalnız authenticated (iç is_admin guard'lı).
revoke execute on function public.admin_list_partnerships() from public, anon;
grant execute on function public.admin_list_partnerships() to authenticated;
revoke execute on function public.admin_set_partnership_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_partnership_status(uuid, text, text) to authenticated;
