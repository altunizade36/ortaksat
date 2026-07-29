-- Admin "Site Kayıtları" MODERASYON aksiyonları (2026-07-29): salt-okunur izleme → gerçek
-- KONTROL. Kullanıcı-üretimli içerik (yorum, ilan soru-cevap) admin tarafından
-- gizlenebilir/silinebilir (küfür/spam/sahte). SECURITY DEFINER + admin guard.

-- Yorum: soft-delete (deleted_at) / geri al. Böylece kayıt korunur, herkese görünmez.
create or replace function public.admin_moderate_review(p_id uuid, p_deleted boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare is_admin boolean;
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into is_admin from public.profiles where id = auth.uid();
  if not coalesce(is_admin, false) then raise exception 'not authorized'; end if;
  update public.reviews set deleted_at = case when p_deleted then now() else null end where id = p_id;
end; $$;
revoke all on function public.admin_moderate_review(uuid, boolean) from public;
grant execute on function public.admin_moderate_review(uuid, boolean) to authenticated;

-- İlan soru-cevap: hard-delete (soft-delete kolonu yok; spam/küfür sorusunu kaldır).
create or replace function public.admin_delete_question(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare is_admin boolean;
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into is_admin from public.profiles where id = auth.uid();
  if not coalesce(is_admin, false) then raise exception 'not authorized'; end if;
  delete from public.listing_questions where id = p_id;
end; $$;
revoke all on function public.admin_delete_question(uuid) from public;
grant execute on function public.admin_delete_question(uuid) to authenticated;

-- Ortak-aranıyor talebi: admin kapatabilir (spam/uygunsuz) → status='closed'.
create or replace function public.admin_close_partner_request(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare is_admin boolean;
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into is_admin from public.profiles where id = auth.uid();
  if not coalesce(is_admin, false) then raise exception 'not authorized'; end if;
  update public.partner_requests set status = 'closed', updated_at = now() where id = p_id;
end; $$;
revoke all on function public.admin_close_partner_request(uuid) from public;
grant execute on function public.admin_close_partner_request(uuid) to authenticated;
