-- ---------------------------------------------------------------------------
-- TEKLİF — GÜVENLİK AÇIĞI KAPATMA + KARŞI TEKLİF AKIŞI
--
-- HATA (kendi eklediğim önceki migration'da): "parties update offers" policy'si
--   using/with check (buyer_id = auth.uid() OR seller_id = auth.uid())
-- diyordu. Yani ALICI da satırı güncelleyebiliyordu → kendi teklifini
-- status='accepted' yapıp amount'u 1 TL'ye çekebilirdi. Satıcı, kabul etmediği
-- bir "anlaşma"yı panelinde görürdü. Policy TARAF kontrolü yapıyor ama ALAN ve
-- DURUM GEÇİŞİ kontrolü yapmıyordu.
--
-- ÇÖZÜM: Açık UPDATE policy'si KALDIRILDI. Tüm durum geçişleri, kimin neyi
-- yapabileceğini zorlayan SECURITY DEFINER RPC'lerden geçer:
--   • SATICI: pending → accepted / rejected / countered(+tutar)
--   • ALICI : pending → withdrawn;  countered → accepted / rejected
-- Tutarı yalnız sunucu belirler (karşı teklif kabul edilirse anlaşma tutarı
-- counter_amount olur) — istemci tutar gönderemez.
-- ---------------------------------------------------------------------------

drop policy if exists "parties update offers" on public.offers;
revoke update on public.offers from authenticated;

-- SATICI yanıtı: kabul / ret / karşı teklif.
create or replace function public.offer_seller_respond(
  p_offer_id uuid,
  p_action text,                    -- 'accepted' | 'rejected' | 'countered'
  p_counter_amount numeric default null
)
returns boolean language plpgsql security definer set search_path to 'public' as $fn$
declare v_me uuid := auth.uid(); v_o public.offers;
begin
  if v_me is null then return false; end if;
  select * into v_o from public.offers where id = p_offer_id;
  if not found then return false; end if;
  if v_o.seller_id <> v_me then raise exception 'not authorized'; end if;
  if v_o.status <> 'pending' then return false; end if;   -- yalnız bekleyen teklif yanıtlanır

  if p_action = 'accepted' then
    update public.offers set status = 'accepted', responded_at = now() where id = p_offer_id;
  elsif p_action = 'rejected' then
    update public.offers set status = 'rejected', responded_at = now() where id = p_offer_id;
  elsif p_action = 'countered' then
    if p_counter_amount is null or p_counter_amount <= 0 then return false; end if;
    update public.offers
      set status = 'countered', counter_amount = p_counter_amount, responded_at = now()
      where id = p_offer_id;
  else
    return false;
  end if;
  return true;
end;
$fn$;
grant execute on function public.offer_seller_respond(uuid, text, numeric) to authenticated;

-- ALICI eylemi: geri çek (pending) veya karşı teklifi kabul/ret (countered).
-- Karşı teklif KABUL edilirse anlaşma tutarı counter_amount olur — tutarı SUNUCU yazar.
create or replace function public.offer_buyer_action(
  p_offer_id uuid,
  p_action text                     -- 'withdrawn' | 'accept_counter' | 'reject_counter'
)
returns boolean language plpgsql security definer set search_path to 'public' as $fn$
declare v_me uuid := auth.uid(); v_o public.offers;
begin
  if v_me is null then return false; end if;
  select * into v_o from public.offers where id = p_offer_id;
  if not found then return false; end if;
  if v_o.buyer_id <> v_me then raise exception 'not authorized'; end if;

  if p_action = 'withdrawn' then
    if v_o.status <> 'pending' then return false; end if;
    update public.offers set status = 'withdrawn', responded_at = now() where id = p_offer_id;
    return true;
  end if;

  if v_o.status <> 'countered' then return false; end if;

  if p_action = 'accept_counter' then
    -- Anlaşma tutarı = satıcının karşı teklifi (istemci tutar gönderemez).
    update public.offers
      set status = 'accepted', amount = coalesce(v_o.counter_amount, v_o.amount), responded_at = now()
      where id = p_offer_id;
    return true;
  elsif p_action = 'reject_counter' then
    update public.offers set status = 'rejected', responded_at = now() where id = p_offer_id;
    return true;
  end if;
  return false;
end;
$fn$;
grant execute on function public.offer_buyer_action(uuid, text) to authenticated;

-- Bildirim tetikleyicisi: alıcı karşı teklifi kabul/ret ederse SATICI da haber alsın
-- (mevcut trigger yalnız alıcıya bildiriyordu — satıcı yanıtları için tasarlanmıştı).
create or replace function public.notify_offer_answered()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_title text; v_body text; v_buyer text;
begin
  if new.status = old.status then return new; end if;
  select title into v_title from public.listings where id = new.listing_id;
  select full_name into v_buyer from public.profiles where id = new.buyer_id;

  -- SATICININ yanıtı (pending → ...) → ALICIYA bildir
  if old.status = 'pending' and new.status in ('accepted', 'rejected', 'countered') then
    if new.status = 'accepted' then
      v_body := format('"%s" ilanındaki %s ₺ teklifin KABUL EDİLDİ. Satıcıyla mesajlaşarak teslimatı ayarla.', coalesce(v_title, 'ilan'), trim(to_char(new.amount, 'FM999G999G999')));
    elsif new.status = 'rejected' then
      v_body := format('"%s" ilanındaki teklifin kabul edilmedi.', coalesce(v_title, 'ilan'));
    else
      v_body := format('Satıcı "%s" için %s ₺ karşı teklif verdi.', coalesce(v_title, 'ilan'), trim(to_char(coalesce(new.counter_amount, 0), 'FM999G999G999')));
    end if;
    insert into public.notifications (user_id, type, title, body, metadata)
    values (new.buyer_id, 'offer', 'Teklifin yanıtlandı', v_body,
            jsonb_build_object('listingId', new.listing_id, 'offerId', new.id));
    return new;
  end if;

  -- ALICININ karşı-teklif yanıtı (countered → ...) → SATICIYA bildir
  if old.status = 'countered' and new.status in ('accepted', 'rejected') then
    if new.status = 'accepted' then
      v_body := format('%s, "%s" için verdiğin %s ₺ karşı teklifi KABUL ETTİ.', coalesce(v_buyer, 'Alıcı'), coalesce(v_title, 'ilan'), trim(to_char(new.amount, 'FM999G999G999')));
    else
      v_body := format('%s, "%s" için verdiğin karşı teklifi kabul etmedi.', coalesce(v_buyer, 'Alıcı'), coalesce(v_title, 'ilan'));
    end if;
    insert into public.notifications (user_id, type, title, body, metadata)
    values (new.seller_id, 'offer', 'Karşı teklifin yanıtlandı', v_body,
            jsonb_build_object('listingId', new.listing_id, 'offerId', new.id));
    return new;
  end if;

  return new;
end;
$fn$;
