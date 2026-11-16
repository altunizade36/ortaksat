-- Ortaklık bildirim boşlukları (2026-11-16):
--  1) İade süresi dolup komisyon "ödemeye hazır" olduğunda kimseye haber gitmiyordu (gece zamanlayıcısı sessizce
--     durumu değiştiriyordu). Artık ortağa ve satıcıya bildirim gider. İade süresi olmayan satışta ilk bildirim
--     "ödemeye hazır" der.
--  2) Alıcının satış onayı / itirazı bildirimleri boş üst veriyle yazılıyordu → tıklanınca hiçbir yere gitmiyordu.
--  3) İlan satılınca (stok bitince) yalnız favorileyenlere haber gidiyordu; o ilanda aktif ortaklığı olanlara da
--     "ilan satıldı, tanıtımı durdurabilirsin" bildirimi gider.

CREATE OR REPLACE FUNCTION private.notify_commission_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_owner uuid; v_partner uuid; v_title text; v_currency text; v_amount text;
  v_targets uuid[] := '{}'; v_head text; v_body text; v_to uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select owner_id, private.display_listing_title(title), coalesce(nullif(currency, ''), 'TRY') into v_owner, v_title, v_currency
    from public.listings where id = new.listing_id;
  select partner_id into v_partner from public.partnerships where id = new.partnership_id;
  v_title := coalesce(nullif(btrim(v_title), ''), 'İlan');
  v_amount := rtrim(rtrim(to_char(new.amount, 'FM999999999990.00'), '0'), '.') || ' '
              || case when v_currency = 'TRY' then 'TL' else v_currency end;

  if tg_op = 'INSERT' then
    if new.status = 'cancelled' then return new; end if;
    v_targets := array[v_partner]; v_head := 'Satış kaydı oluştu';
    v_body := v_title || ' için ' || v_amount || case when new.status = 'approved'
      then ' komisyon kaydın oluştu ve ödemeye hazır.'
      else ' komisyon kaydın oluştu; iade süresi bitince ödemeye hazır olur.' end;
  elsif new.status = 'approved' and old.status = 'return_pending' then
    -- İade süresi doldu (gece zamanlayıcısı): iki taraf da ödemenin zamanı geldiğini bilsin.
    v_targets := array[v_partner, v_owner]; v_head := 'Komisyon ödemeye hazır';
    v_body := v_title || ' için ' || v_amount || ' komisyonun iade süresi doldu; ödeme anlaşmadaki vadeye göre yapılabilir.';
  elsif new.status = 'seller_paid' then
    v_targets := array[v_partner]; v_head := 'Komisyon ödendi bildirildi';
    v_body := v_title || ' için ' || v_amount || ' ödendiği bildirildi. Ödemeyi aldıysan onayla.';
  elsif new.status = 'paid' then
    v_targets := array[v_owner]; v_head := 'Ortak ödemeyi onayladı';
    v_body := v_title || ' için ' || v_amount || ' komisyon kapandı.';
  elsif new.status = 'cancelled' then
    v_targets := array[v_partner, v_owner]; v_head := 'Satış/komisyon iptal edildi';
    v_body := v_title || ' için komisyon kaydı iptal edildi.';
  elsif new.status = 'disputed' then
    v_targets := array[v_partner, v_owner]; v_head := 'Komisyon anlaşmazlığı açıldı';
    v_body := v_title || ' komisyonu için anlaşmazlık bildirildi. Panelden inceleyip çözebilirsin.';
  else
    return new;
  end if;

  foreach v_to in array v_targets loop
    continue when v_to is null or v_to is not distinct from v_actor;
    begin
      -- Toplu ödeme bildirimi: aynı ortağa saniyeler içinde aynı başlıkla ikinci bildirim yazılmaz.
      insert into public.notifications (user_id, type, title, body, metadata)
      select v_to, case when tg_op = 'INSERT' then 'sale' else 'payout' end, v_head, left(v_body, 500),
             jsonb_build_object('listingId', new.listing_id, 'partnershipId', new.partnership_id, 'saleId', new.id)
      where exists (select 1 from public.profiles p where p.id = v_to and p.status <> 'deleted')
        and not exists (
          select 1 from public.notifications n
          where n.user_id = v_to and n.type = 'payout' and n.title = v_head
            and n.metadata ->> 'partnershipId' = new.partnership_id::text
            and n.created_at > now() - interval '20 seconds');
    exception when others then null; -- bildirim yazılamasa da komisyon kaydı korunur
    end;
  end loop;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.confirm_sale(p_token text, p_action text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    if v_owner is not null then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_owner, 'sale', 'Alıcı satışı onayladı', coalesce(v_title,'İlan') || ' için alıcı alışverişi onayladı — komisyon doğrulandı.', false, jsonb_build_object('listingId', v_listing, 'partnershipId', v_partnership, 'saleId', v_id)); end if;
    if v_partner is not null and v_partner <> v_owner then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_partner, 'sale', 'Alıcı satışı onayladı', coalesce(v_title,'İlan') || ' için alıcı onayı geldi — komisyonun doğrulandı.', false, jsonb_build_object('listingId', v_listing, 'partnershipId', v_partnership, 'saleId', v_id)); end if;
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
    if v_owner is not null then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_owner, 'sale', 'Alıcı satışa itiraz etti', coalesce(v_title,'İlan') || ' için alıcı bir sorun bildirdi. Lütfen kontrol et.', false, jsonb_build_object('listingId', v_listing, 'partnershipId', v_partnership, 'saleId', v_id)); end if;
    if v_partner is not null and v_partner <> v_owner then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_partner, 'sale', 'Alıcı satışa itiraz etti', coalesce(v_title,'İlan') || ' için alıcı sorun bildirdi.', false, jsonb_build_object('listingId', v_listing, 'partnershipId', v_partnership, 'saleId', v_id)); end if;
    return 'disputed';
  end if;
  return 'invalid';
end; $function$;

create or replace function public.notify_listing_sold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    insert into public.notifications (user_id, type, title, body, metadata)
    select f.user_id, 'sold', 'Favorindeki ürün satıldı',
           format('"%s" ilanı satıldı. Benzer ilanlara göz atabilirsin.', private.display_listing_title(new.title)),
           jsonb_build_object('listingId', new.id)
    from public.favorites f
    where f.listing_id = new.id and f.user_id <> new.owner_id;

    -- Ortaklar: ürün kalmadı, tanıtmaya devam etmesinler (ortaklık ve kayıtlı komisyonlar korunur).
    begin
      insert into public.notifications (user_id, type, title, body, metadata)
      select p.partner_id, 'application', 'Ortak olduğun ilan satıldı',
             format('"%s" ilanında stok kalmadı. Tanıtımı durdurabilirsin; kayıtlı komisyonların ve anlaşman korunur.', private.display_listing_title(new.title)),
             jsonb_build_object('listingId', new.id, 'partnershipId', p.id, 'kind', 'listing_sold')
      from public.partnerships p
      where p.listing_id = new.id and p.status = 'active' and p.partner_id <> new.owner_id
        and not exists (select 1 from public.favorites f where f.listing_id = new.id and f.user_id = p.partner_id);
    exception when others then
      null;
    end;
  end if;
  return new;
end $$;
