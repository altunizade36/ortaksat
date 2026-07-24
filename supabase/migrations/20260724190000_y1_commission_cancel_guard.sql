-- Y1 — KOMİSYON İPTAL KORUMASI
-- Sorun (denetim S3): guard_commission_paid tutarı kilitliyor + paid-geçişini koruyor AMA
--   'cancelled' geçişini engellemiyordu. commissions UPDATE RLS ("listing owner updates
--   commissions") satıcıya izinli → satıcı BORÇLU/anlaşmazlıktaki komisyonu tek taraflı
--   'cancelled' yapıp ortağın hakkını (borcunu) SİLEBİLİYORDU. Bu, ortaklık güvenini bozar.
-- Çözüm: komisyon 'cancelled'a YALNIZ (a) sistem/iade işleme (auth.uid null → SECURITY DEFINER
--   advance_return_pending_commissions), (b) admin/moderatör (itiraz çözümü — admin panelinde
--   "Çöz·İptal" zaten var), (c) ORTAĞIN kendisi (kendi hakkından feragat) tarafından çekilebilir.
--   Satıcı/ilan-sahibi tek taraflı iptal edemez → anlaşmazlık yönetime taşınır.
-- Diğer tüm mevcut kurallar (tutar kilidi, paid-geçişi) AYNEN korunur.

create or replace function public.guard_commission_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_partner uuid;
  v_role text;
  v_admin_uuid constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  -- Para değerleri record_sale INSERT'inde kilitlenir; SONRADAN HİÇBİR YOL değiştiremez.
  if tg_op = 'UPDATE' then
    if new.amount is distinct from old.amount or new.sale_amount is distinct from old.sale_amount then
      raise exception 'Komisyon tutarı değiştirilemez (kayıt anında kilitlenir).';
    end if;
  end if;

  -- Kimlik/rol yalnız GEREKTİĞİNDE (auth'lu kullanıcı statü değiştiriyor). service_role /
  -- sistem (auth.uid null → iade işleme) tüm bu kontrollerden muaftır.
  if auth.uid() is not null and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    select p.partner_id into v_partner from public.partnerships p where p.id = new.partnership_id;
    select role into v_role from public.profiles where id = auth.uid();

    -- (KORUNAN) paid: yalnız ortak; yalnız seller_paid/disputed'dan gelebilir.
    if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
      if auth.uid() <> coalesce(v_partner, v_admin_uuid)
         and coalesce(v_role, 'user') not in ('admin', 'moderator', 'super_admin') then
        raise exception 'Komisyon ödeme onayı (paid) yalnız ortak tarafından yapılabilir.';
      end if;
      if tg_op = 'UPDATE' and old.status not in ('seller_paid', 'disputed')
         and coalesce(v_role, 'user') not in ('admin', 'moderator', 'super_admin') then
        raise exception 'Ödeme onayı yalnız satıcı ödeme bildirdikten sonra yapılabilir.';
      end if;
    end if;

    -- (YENİ Y1) cancelled: satıcı/ilan-sahibi BORÇLU komisyonu tek taraflı iptal edip borcu
    -- SİLEMEZ. Yalnız admin/moderatör (itiraz çözümü) veya ORTAĞIN kendisi (feragat) iptal eder.
    -- Sistem/iade (auth.uid null) yukarıdaki koşula girmediği için zaten serbesttir.
    if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      if auth.uid() <> coalesce(v_partner, v_admin_uuid)
         and coalesce(v_role, 'user') not in ('admin', 'moderator', 'super_admin') then
        raise exception 'Borçlu komisyon tek taraflı iptal edilemez; anlaşmazlık yönetim tarafından çözülür.';
      end if;
    end if;
  end if;

  return new;
end
$fn$;
