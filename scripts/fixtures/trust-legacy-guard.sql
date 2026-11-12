-- Existing server guard, captured from the read-only schema audit. Synthetic tests only.
CREATE OR REPLACE FUNCTION public.guard_commission_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_partner uuid;
  v_owner   uuid;
  v_role    text;
  v_uid     uuid := auth.uid();
  v_staff   boolean;
  v_admin_uuid constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  -- Para değerleri record_sale INSERT'inde kilitlenir; SONRADAN HİÇBİR YOL değiştiremez.
  if tg_op = 'UPDATE' then
    if new.amount is distinct from old.amount or new.sale_amount is distinct from old.sale_amount then
      raise exception 'Komisyon tutarı değiştirilemez (kayıt anında kilitlenir).';
    end if;
  end if;

  -- (YENİ — denetim HIGH) return_until (iade penceresi) YALNIZ record_sale INSERT'i + sistem/cron
  -- tarafından belirlenir; hiçbir auth'lu kullanıcı (ortak/satıcı) elle değiştiremez. Aksi hâlde
  -- ortak return_until'i öne çekip gece cron'unu erken 'approved'e tetikler (leaderboard/tier şişer).
  -- Sistem (auth.uid null: cron) + staff muaf.
  if tg_op = 'UPDATE' and v_uid is not null and new.return_until is distinct from old.return_until then
    select role into v_role from public.profiles where id = v_uid;
    if coalesce(v_role, 'user') not in ('admin', 'moderator', 'super_admin') then
      raise exception 'İade penceresi (return_until) elle değiştirilemez; sistem yönetir.';
    end if;
  end if;

  -- Kimlik/rol yalnız GEREKTİĞİNDE. service_role / sistem (auth.uid null → iade işleme,
  -- confirm_sale anon çağrısı) tüm bu kontrollerden muaftır.
  if v_uid is not null and (tg_op = 'INSERT' or new.status is distinct from old.status
      or (tg_op = 'UPDATE' and (new.buyer_confirmed_at is distinct from old.buyer_confirmed_at
                                or new.buyer_confirm_status is distinct from old.buyer_confirm_status))) then
    select p.partner_id into v_partner from public.partnerships p where p.id = new.partnership_id;
    select l.owner_id  into v_owner   from public.listings l    where l.id = new.listing_id;
    if v_role is null then select role into v_role from public.profiles where id = v_uid; end if;
    v_staff := coalesce(v_role, 'user') in ('admin', 'moderator', 'super_admin');

    -- (KORUNAN) paid: yalnız ortak; yalnız seller_paid/disputed'dan gelebilir.
    if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
      if v_uid <> coalesce(v_partner, v_admin_uuid) and not v_staff then
        raise exception 'Komisyon ödeme onayı (paid) yalnız ortak tarafından yapılabilir.';
      end if;
      if tg_op = 'UPDATE' and old.status not in ('seller_paid', 'disputed') and not v_staff then
        raise exception 'Ödeme onayı yalnız satıcı ödeme bildirdikten sonra yapılabilir.';
      end if;
    end if;

    -- (KORUNAN, Y1) cancelled: satıcı/ilan-sahibi BORÇLU komisyonu tek taraflı iptal edemez.
    if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      if v_uid <> coalesce(v_partner, v_admin_uuid) and not v_staff then
        raise exception 'Borçlu komisyon tek taraflı iptal edilemez; anlaşmazlık yönetim tarafından çözülür.';
      end if;
    end if;

    -- (KORUNAN) Ortak KENDİ komisyonunu approved/seller_paid/return_pending'e ÇEKEMEZ.
    if tg_op = 'UPDATE' and v_uid = coalesce(v_partner, v_admin_uuid) and v_uid <> coalesce(v_owner, v_admin_uuid)
       and not v_staff and new.status is distinct from old.status
       and new.status in ('approved', 'seller_paid', 'return_pending') then
      raise exception 'Ortak komisyonu onaylı/ödendi durumuna kendisi geçiremez; iade penceresi ve satıcı onayı gerekir.';
    end if;

    -- (KORUNAN) Terminal durum (paid/cancelled) çıkışı yalnız yönetim/sistem.
    if tg_op = 'UPDATE' and old.status in ('paid', 'cancelled') and new.status is distinct from old.status
       and not v_staff then
      raise exception 'Sonuçlanmış komisyon (ödenmiş/iptal) durumu değiştirilemez.';
    end if;

    -- (KORUNAN) buyer_confirmed_at / buyer_confirm_status: yalnız alıcı bağlantısı/admin/sistem.
    if tg_op = 'UPDATE' and (new.buyer_confirmed_at is distinct from old.buyer_confirmed_at
                             or new.buyer_confirm_status is distinct from old.buyer_confirm_status) then
      if (v_uid = coalesce(v_owner, v_admin_uuid) or v_uid = coalesce(v_partner, v_admin_uuid)) and not v_staff then
        raise exception 'Alıcı onayı yalnız alıcıya gönderilen doğrulama bağlantısından yapılabilir.';
      end if;
    end if;
  end if;

  return new;
end
$function$
;
create trigger legacy_guard before update on public.commissions for each row execute function public.guard_commission_paid();
