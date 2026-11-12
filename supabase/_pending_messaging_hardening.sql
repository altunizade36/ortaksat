-- Mesajlaşma / bildirim / teklif sertleştirmesi (2026-11-12)
-- A) messages: alıcı yalnız `read` güncelleyebilir; INSERT sunucuda doğrulanır
-- B) conversations: aynı ilan + aynı iki kişi için tek konuşma; istemci UPDATE/DELETE yapamaz
-- C) notifications: doğrudan istemci eklemesi yalnız application/sale/payout; "yeni mesaj" bildirimi sunucuda
-- D) bozuk karakterli (mojibake) bildirim metinleri düzeltildi
-- E) bildirim tercihleri anonim tetiklenen bildirimlerde de uygulanır
-- F) eski sessize alma anahtarları yeni anahtara taşındı
-- G) push token tek kullanıcıya ait
-- H) engelli çift teklif veremez; geri çekilen teklif satıcıya bildirilir
-- I) e-posta şablonu marka mavisi
-- J) ölçek indeksleri
begin;

-- ───────────── A) messages ─────────────
revoke update, delete on public.messages from authenticated, anon;
grant update (read) on public.messages to authenticated;

create or replace function private.guard_message_insert() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_conv public.conversations;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.created_at := now();
  new.read := false;
  new.deleted_at := null;
  select * into v_conv from public.conversations where id = new.conversation_id;
  if not found then raise exception 'conversation not found' using errcode = '23503'; end if;
  if v_conv.status <> 'open' then raise exception 'conversation closed' using errcode = '42501'; end if;
  if new.receiver_id = new.sender_id
     or not (new.receiver_id = any (v_conv.participant_ids))
     or not (new.sender_id = any (v_conv.participant_ids)) then
    raise exception 'receiver is not a participant' using errcode = '42501';
  end if;
  new.listing_id := v_conv.listing_id;
  new.body := left(coalesce(new.body, ''), 4000);
  if btrim(new.body) = '' and new.attachment_url is null then
    raise exception 'empty message' using errcode = '23514';
  end if;
  if new.attachment_url is not null and not (
       new.attachment_url like 'https://%'
       and position('/storage/v1/object/public/listing-images/' || new.sender_id::text || '/' in new.attachment_url) > 0) then
    raise exception 'attachment must be an uploaded file' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.guard_message_insert() from public, anon, authenticated;

drop trigger if exists guard_message_insert on public.messages;
create trigger guard_message_insert before insert on public.messages
  for each row execute function private.guard_message_insert();

-- ───────────── B) conversations ─────────────
create unique index if not exists conversations_unique_pair on public.conversations
  (listing_id, least(participant_ids[1], participant_ids[2]), greatest(participant_ids[1], participant_ids[2]))
  where cardinality(participant_ids) = 2;
revoke update, delete on public.conversations from authenticated, anon;

create or replace function private.guard_conversation_insert() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if cardinality(new.participant_ids) <> 2 or new.participant_ids[1] = new.participant_ids[2]
     or not (auth.uid() = any (new.participant_ids)) then
    raise exception 'invalid participants' using errcode = '42501';
  end if;
  if public.is_blocked(new.participant_ids[1], new.participant_ids[2]) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  if not exists (select 1 from public.listings l where l.id = new.listing_id and l.owner_id = new.seller_id) then
    raise exception 'seller mismatch' using errcode = '42501';
  end if;
  new.status := 'open';
  new.created_at := now();
  new.last_message_at := now();
  return new;
end $$;
revoke all on function private.guard_conversation_insert() from public, anon, authenticated;

drop trigger if exists guard_conversation_insert on public.conversations;
create trigger guard_conversation_insert before insert on public.conversations
  for each row execute function private.guard_conversation_insert();

-- ───────────── C) notifications ─────────────
-- Köken işareti: bu tetikleyici SECURITY INVOKER'dır; INSERT'i doğrudan istemci (PostgREST rolü
-- authenticated/anon) yaptıysa '1', bir SECURITY DEFINER fonksiyon/tetikleyici (sahibi postgres)
-- yaptıysa '0' yazar. Adı alfabetik olarak guard_notification_insert'ten ÖNCE gelmelidir.
create or replace function private.notification_origin() returns trigger
language plpgsql set search_path to '' as $$
begin
  perform set_config('app.notify_direct', case when current_user in ('authenticated', 'anon') then '1' else '0' end, true);
  return new;
end $$;

drop trigger if exists a_notification_origin on public.notifications;
create trigger a_notification_origin before insert on public.notifications
  for each row execute function private.notification_origin();

create or replace function private.guard_notification_insert() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_recent int;
begin
  new.actor_id := auth.uid();
  -- Sunucu kökenli (tetikleyici / RPC / servis) bildirimler doğrudan geçer.
  if coalesce(current_setting('app.notify_direct', true), '') <> '1' then return new; end if;
  if auth.uid() is null then return null; end if;
  if public.is_admin() or new.user_id = auth.uid() then return new; end if;
  -- İstemci başka bir kullanıcıya yalnız bu türleri yazabilir. "message", "lead", "review", "offer"…
  -- sunucu tetikleyicilerinde üretilir; "system" yalnız yönetimindir (uygulama içi oltalama kapısı).
  if new.type not in ('application', 'sale', 'payout') then return null; end if;
  if public.is_blocked(auth.uid(), new.user_id) then return null; end if;
  new.title := left(new.title, 120);
  new.body := left(new.body, 500);
  new.read := false;
  new.created_at := now();
  select count(*) into v_recent from public.notifications
    where actor_id = auth.uid() and user_id <> auth.uid()
      and created_at > now() - interval '1 hour';
  if v_recent >= 100 then
    raise exception 'Notification rate limit exceeded';
  end if;
  return new;
end $$;

create or replace function private.notify_on_message() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_name text; v_preview text;
begin
  if new.receiver_id is null or new.receiver_id = new.sender_id then return new; end if;
  select nullif(btrim(full_name), '') into v_name from public.profiles where id = new.sender_id;
  v_preview := case when btrim(coalesce(new.body, '')) <> '' then left(new.body, 140)
                    when new.attachment_type = 'file' then '📎 ' || coalesce(new.attachment_name, 'Dosya')
                    else '📷 Görsel' end;
  begin
    insert into public.notifications (user_id, type, title, body, metadata)
    values (new.receiver_id, 'message', 'Yeni mesaj', coalesce(v_name, 'Bir kullanıcı') || ': ' || v_preview,
            jsonb_build_object('conversationId', new.conversation_id, 'listingId', new.listing_id));
  exception when others then
    null; -- bildirim yazılamasa da mesaj kaydı korunur
  end;
  return new;
end $$;
revoke all on function private.notify_on_message() from public, anon, authenticated;

drop trigger if exists notify_on_message on public.messages;
create trigger notify_on_message after insert on public.messages
  for each row execute function private.notify_on_message();

-- ───────────── D) mojibake düzeltmeleri ─────────────
create or replace function public.notify_price_drop() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = 'active' and new.price is not null and old.price is not null and new.price < old.price then
    insert into public.notifications (user_id, type, title, body, metadata)
    select f.user_id, 'price_drop', 'Favorindeki üründe fiyat düştü',
           format('"%s" ilanının fiyatı düştü. Kaçırmadan incele.', new.title),
           jsonb_build_object('listingId', new.id)
    from public.favorites f
    where f.listing_id = new.id and f.user_id <> new.owner_id;
  end if;
  return new;
end $$;

create or replace function public.notify_listing_sold() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    insert into public.notifications (user_id, type, title, body, metadata)
    select f.user_id, 'sold', 'Favorindeki ürün satıldı',
           format('"%s" ilanı satıldı. Benzer ilanlara göz atabilirsin.', new.title),
           jsonb_build_object('listingId', new.id)
    from public.favorites f
    where f.listing_id = new.id and f.user_id <> new.owner_id;
  end if;
  return new;
end $$;

create or replace function public.notify_followers_new_listing() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  -- Yalnızca İLK yayın: doğrudan aktif INSERT veya taslak/inceleme→aktif geçiş.
  -- (paused→active yeniden yayını takipçilere "yeni ilan" gibi spam olmasın.)
  if new.status = 'active' and (tg_op = 'INSERT' or old.status in ('draft', 'pending_review')) then
    insert into public.notifications (user_id, type, title, body, metadata)
    select fl.follower_id, 'follow', 'Takip ettiğin satıcıdan yeni ilan',
           format('Takip ettiğin bir satıcı "%s" ilanını yayınladı.', new.title),
           jsonb_build_object('listingId', new.id)
    from public.follows fl
    where fl.seller_id = new.owner_id and fl.follower_id <> new.owner_id;
  end if;
  return new;
end $$;

-- ───────────── E) tercih koruması her kökende uygulanır ─────────────
create or replace function private.mobile_notification_preference_guard() returns trigger
language plpgsql security definer set search_path to '' as $$
declare prefs jsonb;
begin
  select p.preferences into prefs from public.profiles p where p.id = new.user_id;
  if not public.mobile_notification_enabled(coalesce(prefs, '{}'::jsonb), new.type::text) then return null; end if;
  if new.type::text = 'price_drop'
     and coalesce(prefs ->> ('notify_price_drop_skip:' || coalesce(new.metadata ->> 'listingId', '')), 'false') = 'true' then
    return null;
  end if;
  return new;
end $$;

-- ───────────── F) eski sessize alma anahtarlarını taşı ─────────────
update public.profiles p set preferences = p.preferences || (
  select jsonb_object_agg('notify_type_' || substr(e.k, 12), false)
  from jsonb_each(p.preferences) e(k, v)
  where e.k like 'notif\_mute\_%' and e.v = 'true'::jsonb and not (p.preferences ? ('notify_type_' || substr(e.k, 12))))
where exists (
  select 1 from jsonb_each(p.preferences) e(k, v)
  where e.k like 'notif\_mute\_%' and e.v = 'true'::jsonb and not (p.preferences ? ('notify_type_' || substr(e.k, 12))));

-- ───────────── G) push token tek sahipli ─────────────
create or replace function private.push_token_single_owner() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from public.push_tokens where token = new.token and user_id <> new.user_id;
  return new;
end $$;
revoke all on function private.push_token_single_owner() from public, anon, authenticated;

drop trigger if exists push_token_single_owner on public.push_tokens;
create trigger push_token_single_owner before insert or update on public.push_tokens
  for each row execute function private.push_token_single_owner();

-- ───────────── H) teklifler ─────────────
drop policy if exists "blocked cannot offer" on public.offers;
create policy "blocked cannot offer" on public.offers as restrictive for insert to authenticated
  with check (not public.is_blocked(buyer_id, seller_id));

create or replace function public.notify_offer_answered() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
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

  -- ALICI bekleyen teklifini geri çekti → SATICIYA bildir
  if old.status = 'pending' and new.status = 'withdrawn' then
    insert into public.notifications (user_id, type, title, body, metadata)
    values (new.seller_id, 'offer', 'Teklif geri çekildi',
            format('%s, "%s" için verdiği teklifi geri çekti.', coalesce(v_buyer, 'Alıcı'), coalesce(v_title, 'ilan')),
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
$function$;

-- ───────────── I) e-posta şablonu marka mavisi ─────────────
do $$ declare src text; begin
  select pg_get_functiondef('private.email_on_notification()'::regprocedure) into src;
  src := replace(replace(replace(src, '#00866F', '#0645C9'), '#075E54', '#09275E'), '#CFF3EA', '#E5F0FF');
  execute src;
end $$;

-- ───────────── J) ölçek indeksleri ─────────────
create index if not exists messages_receiver_unread_idx on public.messages (receiver_id, conversation_id) where read = false;
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_receiver_created_idx on public.messages (receiver_id, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

commit;
