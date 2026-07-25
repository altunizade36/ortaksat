-- ---------------------------------------------------------------------------
-- KOMİSYON DURUM-MAKİNESİ SUNUCU GUARD'I (denetim bulgusu: durum-makinesi baypası)
--
-- SORUN: commissions UPDATE RLS ("listing owner updates" + partner kendi satırını okur/yazar)
--   yeterince dar değildi; durum-makinesinin bir kısmı yalnız İSTEMCİDE zorlanıyordu:
--   1) Ortak, kendi 'return_pending' komisyonunu doğrudan REST ile status='approved' yapıp
--      iade penceresi dolmadan public leaderboard'daki confirmed_sales'ini ERKEN ŞİŞİREBİLİR
--      (tier + "En çok kazandıran ortaklar" bütünlüğü bozulur). Meşru 'approved'e geçiş yalnız
--      sistem (advance_return_pending_commissions, auth.uid null) / SATICI / admin tarafından olur.
--   2) Terminal durumdan (paid/cancelled) geri-geçiş (paid→approved gibi) DB'de engellenmemişti.
--   3) buyer_confirmed_at / buyer_confirm_status alanları guard'sızdı → SATICI kendi satışını
--      REST ile "alıcı onayladı" işaretleyip iki-taraflı doğrulamayı sahteleştirebilirdi.
--
-- ÇÖZÜM: guard_commission_paid()'e üç yeni geçiş kısıtı eklenir. MEVCUT tüm kurallar
--   (tutar kilidi, paid yalnız-ortak, cancelled satıcı-değil) AYNEN korunur. Satış GERÇEK
--   (record_sale'i satıcı üretir) — bu yalnız durum-makinesi bütünlüğünü sunucuya taşır.
--   Platform PARA TUTMAZ; bu koruma yalnız komisyon KAYDININ güvenilirliği içindir.
--
-- Meşru geçiş matrisi (auth'lu, staff-dışı):
--   return_pending → approved : SATICI(owner) veya sistem(cron)   [ortak DEĞİL]
--   approved       → seller_paid: SATICI(owner)                    [ortak DEĞİL]
--   seller_paid    → paid       : ORTAK(partner)                   [zaten korumalı]
--   herhangi       → disputed   : taraflar / confirm_sale
--   herhangi       → cancelled  : ortak(feragat)/admin/sistem      [satıcı DEĞİL, Y1]
--   buyer_confirm* : yalnız alıcı bağlantısı(confirm_sale)/admin/sistem [owner/partner DEĞİL]
-- ---------------------------------------------------------------------------

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

  -- Kimlik/rol yalnız GEREKTİĞİNDE. service_role / sistem (auth.uid null → iade işleme,
  -- confirm_sale anon çağrısı) tüm bu kontrollerden muaftır.
  if v_uid is not null and (tg_op = 'INSERT' or new.status is distinct from old.status
      or (tg_op = 'UPDATE' and (new.buyer_confirmed_at is distinct from old.buyer_confirmed_at
                                or new.buyer_confirm_status is distinct from old.buyer_confirm_status))) then
    select p.partner_id into v_partner from public.partnerships p where p.id = new.partnership_id;
    select l.owner_id  into v_owner   from public.listings l    where l.id = new.listing_id;
    select role into v_role from public.profiles where id = v_uid;
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

    -- (YENİ 1) Ortak KENDİ komisyonunu approved/seller_paid/return_pending'e ÇEKEMEZ.
    -- Bunlar sistem(iade penceresi) veya satıcı onayı gerektiren geçişlerdir; ortağın tek
    -- meşru statü yazımı seller_paid→paid (+ disputed / cancelled-feragat). Aksi hâlde ortak
    -- iade penceresi dolmadan onaylı-satışını erken sayıp leaderboard/tier'ı şişirir.
    if tg_op = 'UPDATE' and v_uid = coalesce(v_partner, v_admin_uuid) and v_uid <> coalesce(v_owner, v_admin_uuid)
       and not v_staff and new.status is distinct from old.status
       and new.status in ('approved', 'seller_paid', 'return_pending') then
      raise exception 'Ortak komisyonu onaylı/ödendi durumuna kendisi geçiremez; iade penceresi ve satıcı onayı gerekir.';
    end if;

    -- (YENİ 2) Terminal durum (paid/cancelled) çıkışı yalnız yönetim/sistem. paid→approved gibi
    -- geri-geçişler istemcide engelli; DB'de de aynalanır (bütünlük son savunma hattı).
    if tg_op = 'UPDATE' and old.status in ('paid', 'cancelled') and new.status is distinct from old.status
       and not v_staff then
      raise exception 'Sonuçlanmış komisyon (ödenmiş/iptal) durumu değiştirilemez.';
    end if;

    -- (YENİ 3) buyer_confirmed_at / buyer_confirm_status: iki-taraflı doğrulamanın alıcı ayağı.
    -- Yalnız alıcı doğrulama bağlantısı (confirm_sale — anon veya login'li ALICI; owner/partner
    -- DEĞİL), admin veya sistem yazabilir. Satıcı/ortak kendi satışını "alıcı onayladı" yapamaz.
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
