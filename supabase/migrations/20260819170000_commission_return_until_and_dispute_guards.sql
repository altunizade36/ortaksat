-- ============================================================================
-- 2026-08-19 — Para-akışı denetimi: komisyon durum-makinesindeki iki KALAN delik
-- ============================================================================
-- Çekirdek kayıt yolu (record_sale) + durum guard'ı (20260725130000) SAĞLAM. Kalan iki hol:
--
-- BULGU 1 (HIGH): return_until (iade penceresi) kolonu guard'sızdı. Ortağın komisyon UPDATE RLS'i
--   TÜM satırı yazabildiğinden, ortak kendi 'return_pending' komisyonunun return_until'ini GEÇMİŞE
--   çekip gece cron'unu (advance_return_pending_commissions, return_until<current_date → 'approved')
--   ERKEN tetikleyebiliyordu → iade penceresi dolmadan public leaderboard confirmed_sales + tier
--   ŞİŞER ve record_payout ile erken ödenebilir hâle gelir. Bu tam da 20260725130000'in kapatmayı
--   amaçladığı baypasın trigger-anahtarı (return_until) tarafıydı.
--   DOĞRULAMA: return_until YALNIZ record_sale INSERT'inde yazılır; hiçbir UPDATE yolu (record_payout
--   dahil: yalnız status/seller_marked_paid_at/payout_id yazar) değiştirmez → guard %100 güvenli.
--
-- BULGU 2 (LOW/MED): confirm_sale('dispute') mevcut komisyon STATÜSÜNÜ kontrol etmiyordu. Fonksiyon
--   SECURITY DEFINER + anon-grant (auth.uid null) → guard_commission_paid'in terminal-koruması
--   (v_uid null iken atlanır) devreye girmez. Alıcı-doğrulama token'ını tutan biri, SONUÇLANMIŞ
--   (paid/cancelled, buyer_confirmed_at null) komisyonu 'disputed'e çevirip yeniden AÇABİLİYORDU.
-- ============================================================================

-- ---- FIX 1: guard_commission_paid'e return_until kilidi ekle (mevcut tüm kurallar korunur) ----
create or replace function public.guard_commission_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
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
$fn$;

drop trigger if exists trg_guard_commission_paid on public.commissions;
create trigger trg_guard_commission_paid
  before update on public.commissions
  for each row execute function public.guard_commission_paid();

-- ---- FIX 2: confirm_sale('dispute') SONUÇLANMIŞ (paid/cancelled) komisyonu yeniden açamasın ----
create or replace function public.confirm_sale(p_token text, p_action text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_confirmed timestamptz; v_status text; v_cstatus text; v_listing uuid; v_partnership uuid; v_owner uuid; v_partner uuid; v_title text;
begin
  select id, buyer_confirmed_at, buyer_confirm_status, status, listing_id, partnership_id
    into v_id, v_confirmed, v_status, v_cstatus, v_listing, v_partnership
    from public.commissions where buyer_confirm_token = p_token and deleted_at is null limit 1;
  if v_id is null then return 'not_found'; end if;
  select owner_id, title into v_owner, v_title from public.listings where id = v_listing;
  select partner_id into v_partner from public.partnerships where id = v_partnership;

  if p_action = 'confirm' then
    if v_confirmed is not null then return 'already'; end if;
    if v_status = 'disputed' then return 'disputed'; end if; -- itirazlı satış onaya çevrilemez
    update public.commissions set buyer_confirmed_at = now(), buyer_confirm_status = 'confirmed' where id = v_id;
    if v_owner is not null then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_owner, 'sale', 'Alıcı satışı onayladı', coalesce(v_title,'İlan') || ' için alıcı alışverişi onayladı — komisyon doğrulandı.', false, '{}'::jsonb); end if;
    if v_partner is not null and v_partner <> v_owner then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_partner, 'sale', 'Alıcı satışı onayladı', coalesce(v_title,'İlan') || ' için alıcı onayı geldi — komisyonun doğrulandı.', false, '{}'::jsonb); end if;
    return 'confirmed';

  elsif p_action = 'dispute' then
    -- BÜTÜNLÜK: onaylanmış satış itirazlıya ÇEVRİLEMEZ (doğrulanmış komisyon korunur).
    if v_confirmed is not null then return 'confirmed'; end if;
    -- (YENİ — denetim) SONUÇLANMIŞ komisyon (ödenmiş/iptal) itiraza AÇILAMAZ. confirm_sale anon
    -- çağrıldığından (auth.uid null) trigger terminal-koruması atlanır → burada açıkça engellenir.
    if v_cstatus in ('paid', 'cancelled') then return 'closed'; end if;
    -- İDEMPOTENT: zaten itirazlıysa yeni bildirim YOK (spam döngüsü kapalı).
    if v_status = 'disputed' then return 'already'; end if;
    update public.commissions set buyer_confirm_status = 'disputed', status = 'disputed' where id = v_id;
    if v_owner is not null then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_owner, 'sale', 'Alıcı satışa itiraz etti', coalesce(v_title,'İlan') || ' için alıcı bir sorun bildirdi. Lütfen kontrol et.', false, '{}'::jsonb); end if;
    if v_partner is not null and v_partner <> v_owner then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_partner, 'sale', 'Alıcı satışa itiraz etti', coalesce(v_title,'İlan') || ' için alıcı sorun bildirdi.', false, '{}'::jsonb); end if;
    return 'disputed';
  end if;
  return 'invalid';
end; $$;
