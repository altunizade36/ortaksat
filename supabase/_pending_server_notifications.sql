-- Ortaklık ve komisyon bildirimleri SUNUCUDA üretilir (2026-11-12).
-- Eskiden istemci `application` / `sale` / `payout` türünde bildirimi başka kullanıcıya doğrudan
-- yazabiliyordu: (1) sahte "Komisyon ödendi" / "Ortaklık kabul edildi" bildirimi gönderilebiliyordu,
-- (2) işlemi yapan sekme istek bitmeden kapanırsa bildirim hiç oluşmuyordu.
-- Artık partnerships / commissions tetikleyicileri üretir; istemcinin başka kullanıcıya yazdığı
-- TÜM bildirimler (yönetim hariç) sessizce düşer.
begin;

create or replace function private.notify_partnership_change() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid; v_title text; v_name text;
  v_to uuid; v_head text; v_body text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select owner_id, title into v_owner, v_title from public.listings where id = new.listing_id;
  if v_owner is null then return new; end if;
  v_title := coalesce(nullif(btrim(v_title), ''), 'İlan');
  select coalesce(nullif(btrim(full_name), ''), 'Bir kullanıcı') into v_name from public.profiles where id = new.partner_id;
  v_name := coalesce(v_name, 'Bir kullanıcı');

  if new.status = 'pending' then
    v_to := v_owner; v_head := 'Yeni ortak başvurusu';
    v_body := v_name || ', ' || v_title || ' ilanına ' || case when tg_op = 'UPDATE' then 'yeniden başvurdu.' else 'başvurdu.' end;
  elsif new.status = 'active' then
    if tg_op = 'INSERT' or v_actor is not distinct from new.partner_id then
      v_to := v_owner; v_head := 'Yeni ortak katıldı';
      v_body := v_name || ', ' || v_title || ' ilanında ortak satışa katıldı.';
    else
      v_to := new.partner_id; v_head := 'Ortaklık kabul edildi';
      v_body := v_title || ' için ortaklığın aktif. Satıcıyla iletişim kurarak satışa katkı sağlayabilirsin.';
    end if;
  elsif new.status = 'rejected' then
    v_to := new.partner_id; v_head := 'Ortaklık reddedildi';
    v_body := coalesce(nullif(btrim(new.rejection_reason), ''), v_title || ' için ortaklık başvurun kabul edilmedi.');
  elsif new.status in ('cancelled', 'blocked', 'completed') and tg_op = 'UPDATE' then
    if v_actor is not distinct from new.partner_id then
      v_to := v_owner; v_head := 'Ortak ayrıldı';
      v_body := v_name || ', ' || v_title || ' ortaklığından ayrıldı.';
    else
      v_to := new.partner_id;
      v_head := case when new.status = 'blocked' then 'Ortaklık kapatıldı' else 'Ortaklık sonlandırıldı' end;
      v_body := v_title || ' için ortaklığın sonlandırıldı.';
    end if;
  end if;

  if v_to is null or v_to is not distinct from v_actor then return new; end if;
  begin
    insert into public.notifications (user_id, type, title, body, metadata)
    select v_to, 'application', v_head, left(v_body, 500),
           jsonb_build_object('listingId', new.listing_id, 'partnershipId', new.id)
    where exists (select 1 from public.profiles p where p.id = v_to and p.status <> 'deleted');
  exception when others then null; -- bildirim yazılamasa da ortaklık kaydı korunur
  end;
  return new;
end $$;
revoke all on function private.notify_partnership_change() from public, anon, authenticated;

drop trigger if exists notify_partnership_change on public.partnerships;
create trigger notify_partnership_change after insert or update of status on public.partnerships
  for each row execute function private.notify_partnership_change();

create or replace function private.notify_commission_change() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid; v_partner uuid; v_title text; v_currency text; v_amount text;
  v_targets uuid[] := '{}'; v_head text; v_body text; v_to uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select owner_id, title, coalesce(nullif(currency, ''), 'TRY') into v_owner, v_title, v_currency
    from public.listings where id = new.listing_id;
  select partner_id into v_partner from public.partnerships where id = new.partnership_id;
  v_title := coalesce(nullif(btrim(v_title), ''), 'İlan');
  v_amount := rtrim(rtrim(to_char(new.amount, 'FM999999999990.00'), '0'), '.') || ' '
              || case when v_currency = 'TRY' then 'TL' else v_currency end;

  if tg_op = 'INSERT' then
    if new.status = 'cancelled' then return new; end if;
    v_targets := array[v_partner]; v_head := 'Satış kaydı oluştu';
    v_body := v_title || ' için ' || v_amount || ' komisyon kaydın oluştu; iade penceresi kapanınca ödemeye hazır olur.';
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
end $$;
revoke all on function private.notify_commission_change() from public, anon, authenticated;

drop trigger if exists notify_commission_change on public.commissions;
create trigger notify_commission_change after insert or update of status on public.commissions
  for each row execute function private.notify_commission_change();

-- İstemci artık başka bir kullanıcıya HİÇBİR türde bildirim yazamaz (yönetim hariç).
create or replace function private.guard_notification_insert() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  new.actor_id := auth.uid();
  -- Sunucu kökenli (tetikleyici / RPC / servis) bildirimler doğrudan geçer.
  if coalesce(current_setting('app.notify_direct', true), '') <> '1' then return new; end if;
  if auth.uid() is null then return null; end if;
  if public.is_admin() then return new; end if;
  if new.user_id is distinct from auth.uid() then return null; end if;
  new.title := left(new.title, 120);
  new.body := left(new.body, 500);
  new.read := false;
  new.created_at := now();
  return new;
end $$;

commit;

-- Bildirim metinlerinde ilan başlığı: eski ilanlardaki süsleme işaretlerini (⫷⫷ … ⫸⫸, oklar,
-- kutu çizimleri, varyasyon seçiciler) ayıkla — istemcideki displayListingTitle ile aynı amaç.
begin;
create or replace function private.display_listing_title(p_title text) returns text
language sql immutable set search_path to '' as $$
  select coalesce(nullif(btrim(regexp_replace(
           regexp_replace(coalesce(p_title, ''), '[←-⯿　-〿︀-️⃐-⃿]', ' ', 'g'),
           '\s+', ' ', 'g')), ''), 'İlan');
$$;

do $$
declare r record; src text; nxt text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where (n.nspname = 'public' and p.proname in ('notify_offer_created', 'notify_offer_answered', 'notify_on_lead',
                                                         'notify_price_drop', 'notify_listing_sold', 'notify_followers_new_listing'))
              or (n.nspname = 'private' and p.proname in ('notify_partnership_change', 'notify_commission_change'))
  loop
    src := pg_get_functiondef(r.oid);
    nxt := src;
    nxt := replace(nxt, 'select title into v_title from public.listings', 'select private.display_listing_title(title) into v_title from public.listings');
    nxt := replace(nxt, 'select owner_id, title into v_owner, v_title from public.listings', 'select owner_id, private.display_listing_title(title) into v_owner, v_title from public.listings');
    nxt := replace(nxt, 'select owner_id, title, coalesce(nullif(currency', 'select owner_id, private.display_listing_title(title), coalesce(nullif(currency');
    nxt := replace(nxt, ', new.title)', ', private.display_listing_title(new.title))');
    if nxt is distinct from src then execute nxt; end if;
  end loop;
end $$;
commit;
