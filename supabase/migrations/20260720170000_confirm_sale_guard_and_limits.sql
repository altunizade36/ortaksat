-- ---------------------------------------------------------------------------
-- GÜVENLİK #5: confirm_sale dispute idempotency + bütünlük guard'ı.
-- SORUN: dispute dalında durum kontrolü YOKTU → token'ı elinde tutan:
--   (a) döngüde dispute çağırıp her seferinde 2 bildirim (owner+partner) insert ederek
--       SECURITY DEFINER üzerinden bildirim rate-limitini baypaslıyor (spam),
--   (b) ONAYLANMIŞ (buyer_confirmed) bir satışı 'disputed'e geri çevirip komisyon
--       bütünlüğünü bozabiliyordu.
-- ÇÖZÜM: idempotent + tek-yön geçiş. Onaylanmış satış itirazlıya çevrilemez; zaten
-- itirazlı tekrar dispute'ta 'already' döner (yeni bildirim yok → spam yok).
-- ---------------------------------------------------------------------------
create or replace function public.confirm_sale(p_token text, p_action text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_confirmed timestamptz; v_status text; v_listing uuid; v_partnership uuid; v_owner uuid; v_partner uuid; v_title text;
begin
  select id, buyer_confirmed_at, buyer_confirm_status, listing_id, partnership_id
    into v_id, v_confirmed, v_status, v_listing, v_partnership
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
    -- İDEMPOTENT: zaten itirazlıysa yeni bildirim YOK (spam döngüsü kapalı).
    if v_status = 'disputed' then return 'already'; end if;
    update public.commissions set buyer_confirm_status = 'disputed', status = 'disputed' where id = v_id;
    if v_owner is not null then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_owner, 'sale', 'Alıcı satışa itiraz etti', coalesce(v_title,'İlan') || ' için alıcı bir sorun bildirdi. Lütfen kontrol et.', false, '{}'::jsonb); end if;
    if v_partner is not null and v_partner <> v_owner then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_partner, 'sale', 'Alıcı satışa itiraz etti', coalesce(v_title,'İlan') || ' için alıcı sorun bildirdi.', false, '{}'::jsonb); end if;
    return 'disputed';
  end if;
  return 'invalid';
end; $$;

-- ---------------------------------------------------------------------------
-- GÜVENLİK #2: referral_clicks anon-insert alanlarına DB-tarafı uzunluk sınırı
-- (istemci slice(0,24) sınır DEĞİL; anon doğrudan REST ile megabaytlık değer yazıp
-- depolama şişirebilirdi). NOT VALID → mevcut satırları kilitlemeden ekle.
-- ---------------------------------------------------------------------------
alter table public.referral_clicks drop constraint if exists referral_clicks_channel_len;
alter table public.referral_clicks add constraint referral_clicks_channel_len
  check (channel is null or char_length(channel) <= 32) not valid;
alter table public.referral_clicks drop constraint if exists referral_clicks_refcode_len;
alter table public.referral_clicks add constraint referral_clicks_refcode_len
  check (ref_code is null or char_length(ref_code) <= 64) not valid;
