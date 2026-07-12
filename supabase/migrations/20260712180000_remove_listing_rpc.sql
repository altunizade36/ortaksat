-- OrtakSat — SUNUCU-OTORİTELİ ilan kaldırma: remove_listing(listing_id)
-- İstemcinin geçmişi bilmesine GEREK YOK; karar tamamen sunucuda verilir (atomik).
--   Geçmiş YOK  → gerçekten SİL.
--   Geçmiş VAR  → ARŞİVLE + aktif ortaklıkları sonlandır + ortaklara bildirim.
-- Neden: hard-delete'te commissions/orders FK'si NO ACTION (patlar), partnerships/leads ise
-- CASCADE (sessizce silinir) → ortaklık/talep geçmişi kaybolur, ortak haberdar olmaz.
create or replace function public.remove_listing(p_listing_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_has_history boolean; r record;
begin
  select owner_id, title into v_owner, v_title from public.listings where id = p_listing_id;
  if v_owner is null then return 'not_found'; end if;

  -- Yetki: yalnız ilan sahibi ya da admin/moderatör.
  if auth.uid() is distinct from v_owner and not is_admin() then
    raise exception 'Bu ilani kaldirma yetkin yok.';
  end if;

  select exists(select 1 from public.commissions   where listing_id = p_listing_id)
      or exists(select 1 from public.orders        where listing_id = p_listing_id)
      or exists(select 1 from public.partnerships  where listing_id = p_listing_id)
      or exists(select 1 from public.leads         where listing_id = p_listing_id)
    into v_has_history;

  if not v_has_history then
    delete from public.listings where id = p_listing_id;   -- temiz ilan → gerçekten sil
    return 'deleted';
  end if;

  -- Geçmişi olan ilan: gizle ama SATIRI + para/geçmiş kayıtlarını KORU.
  update public.listings set status = 'archived' where id = p_listing_id;

  -- Aktif ortaklıkları sonlandır + ortağı bilgilendir (ölü referans linki bırakma).
  -- (referral_public_links zaten listing/partnership trigger'larıyla otomatik siliniyor.)
  for r in select id, partner_id from public.partnerships
           where listing_id = p_listing_id and status = 'active' loop
    update public.partnerships set status = 'cancelled' where id = r.id;
    insert into public.notifications (id, user_id, type, title, body, read, metadata)
    values (gen_random_uuid(), r.partner_id, 'system', 'İlan kaldırıldı',
            coalesce(v_title, 'İlan') || ' satıcı tarafından kaldırıldı. Ortaklığın sonlandırıldı; hak edilmiş komisyonların korunur.',
            false, '{}'::jsonb);
  end loop;

  return 'archived';
end; $$;

grant execute on function public.remove_listing(uuid) to authenticated;
