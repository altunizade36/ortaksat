-- Yorum / değerlendirme sertleştirmesi (2026-11-12)
-- 1) INSERT sahteciliği: istemci alanları sıfırlanır, taraflar ve satış durumu sunucuda doğrulanır
-- 2) Faydalı oyu: kendi / silinmiş yoruma oy yok
-- 3) Son yorum silinince profil puanı 0'a döner (eskiden bayat kalıyordu)
-- 4) Tekillik: kopya indeks kaldırıldı; kullanıcı kendi sildiği yorumu yeniden yazabilir,
--    yönetimin kaldırdığı yorum yeniden yazılamaz (removed_by_admin)
-- 5) Yanıt: 1000 karakter sınırı, silinmiş yoruma yanıt yok
-- 6) Düzenleme: 10–1000 karakter
-- 7) Silinmiş yorumlar herkese açık okunamaz
-- 8) "Değerlendirme aldın" bildirimi sunucuda üretilir (istemci yazmaz)
begin;

alter table public.reviews add column if not exists removed_by_admin boolean not null default false;

create or replace function private.reviews_guard_insert() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_owner uuid; v_partner uuid; v_status text; v_listing uuid;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.created_at := now();
  new.deleted_at := null;
  new.removed_by_admin := false;
  new.helpful_count := 0;
  new.seller_reply := null;
  new.seller_reply_at := null;
  new.comment := btrim(coalesce(new.comment, ''));
  if char_length(new.comment) not between 10 and 1000 then
    raise exception 'Yorum 10-1000 karakter olmalı.' using errcode = '22023';
  end if;
  select owner_id into v_owner from public.listings where id = new.listing_id;
  if v_owner is null then raise exception 'İlan bulunamadı.' using errcode = '22023'; end if;
  if new.type = 'product' then
    -- Arayüzde ürün yorumu yok; etkileşim kuralı tanımlanana dek kapalı.
    raise exception 'Ürün yorumu şu an kapalı.' using errcode = '42501';
  end if;
  select c.status::text, c.listing_id, p.partner_id into v_status, v_listing, v_partner
    from public.commissions c join public.partnerships p on p.id = c.partnership_id
    where c.id = new.sale_id and c.deleted_at is null;
  if not found or v_listing is distinct from new.listing_id then
    raise exception 'Satış bu ilana ait değil.' using errcode = '42501';
  end if;
  if v_status not in ('approved', 'seller_paid', 'paid') then
    raise exception 'Yalnız tamamlanmış satış değerlendirilebilir.' using errcode = '42501';
  end if;
  if new.reviewer_id = new.reviewed_user_id
     or (new.type = 'seller'  and not (new.reviewer_id = v_partner and new.reviewed_user_id = v_owner))
     or (new.type = 'partner' and not (new.reviewer_id = v_owner  and new.reviewed_user_id = v_partner))
  then
    raise exception 'Değerlendirme tarafları geçersiz.' using errcode = '42501';
  end if;
  if exists (select 1 from public.reviews r where r.sale_id = new.sale_id and r.reviewer_id = new.reviewer_id and r.removed_by_admin) then
    raise exception 'Bu satış için değerlendirmen yönetim tarafından kaldırıldı.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.reviews_guard_insert() from public, anon, authenticated;

drop trigger if exists reviews_guard_insert on public.reviews;
create trigger reviews_guard_insert before insert on public.reviews
  for each row execute function private.reviews_guard_insert();

-- RLS zaten engelliyor (policy yok); derinlemesine savunma.
revoke update, delete on public.reviews from authenticated, anon;
revoke insert, update, delete on public.review_helpful_votes from authenticated, anon;

create or replace function public.toggle_review_helpful(p_review_id uuid)
 returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid := (select auth.uid()); v_exists boolean; v_count int; v_author uuid; v_deleted timestamptz;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select reviewer_id, deleted_at into v_author, v_deleted from public.reviews where id = p_review_id for update;
  if not found or v_deleted is not null then raise exception 'review not found'; end if;
  if v_author = v_uid then raise exception 'own review' using errcode = '42501'; end if;
  select exists(select 1 from public.review_helpful_votes where review_id = p_review_id and user_id = v_uid) into v_exists;
  if v_exists then
    delete from public.review_helpful_votes where review_id = p_review_id and user_id = v_uid;
  else
    insert into public.review_helpful_votes(review_id, user_id) values (p_review_id, v_uid) on conflict do nothing;
  end if;
  select count(*) into v_count from public.review_helpful_votes where review_id = p_review_id;
  update public.reviews set helpful_count = v_count where id = p_review_id;
  return v_count;
end $function$;

create or replace function private.refresh_user_rating_from_reviews()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  uid uuid;
  avg_rating numeric;
begin
  uid := coalesce(new.reviewed_user_id, old.reviewed_user_id);
  if uid is null then
    return coalesce(new, old);
  end if;
  select round(avg(rating)::numeric, 1) into avg_rating
    from public.reviews
    where reviewed_user_id = uid
      and type in ('seller', 'partner')
      and deleted_at is null;
  perform set_config('app.trusted_rating_update', 'on', true);
  update public.profiles set rating = coalesce(avg_rating, 0) where id = uid;
  perform set_config('app.trusted_rating_update', '', true);
  return coalesce(new, old);
end;
$function$;

drop index if exists public.reviews_unique_reviewer_sale;
drop index if exists public.reviews_sale_reviewer_unique;
create unique index reviews_sale_reviewer_unique on public.reviews (sale_id, reviewer_id)
  where sale_id is not null and deleted_at is null;

create or replace function public.admin_moderate_review(p_id uuid, p_deleted boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare is_admin boolean;
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into is_admin from public.profiles where id = auth.uid();
  if not coalesce(is_admin, false) then raise exception 'not authorized'; end if;
  update public.reviews
    set deleted_at = case when p_deleted then now() else null end,
        removed_by_admin = p_deleted
    where id = p_id;
end; $function$;

create or replace function public.reply_to_review(p_review_id uuid, p_reply text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_target uuid; v_deleted timestamptz; v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  select coalesce(r.reviewed_user_id, l.owner_id), r.deleted_at into v_target, v_deleted
    from public.reviews r join public.listings l on l.id = r.listing_id where r.id = p_review_id;
  if v_target is null or v_deleted is not null then raise exception 'review not found'; end if;
  if v_target <> (select auth.uid()) then raise exception 'only the reviewed party can reply' using errcode = '42501'; end if;
  if char_length(v_reply) > 1000 then raise exception 'Yanıt en fazla 1000 karakter olabilir.' using errcode = '22023'; end if;
  update public.reviews
    set seller_reply = v_reply,
        seller_reply_at = case when v_reply is null then null else now() end
    where id = p_review_id;
end $function$;

create or replace function public.edit_own_review(p_review_id uuid, p_rating integer, p_comment text)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return false; end if;
  if p_comment is null or char_length(btrim(p_comment)) not between 10 and 1000 then return false; end if;
  update public.reviews
    set rating = p_rating, comment = btrim(p_comment)
    where id = p_review_id and reviewer_id = v_uid and deleted_at is null;
  return found;
end;
$function$;

alter policy "reviews readable" on public.reviews
  using (deleted_at is null or reviewer_id = (select auth.uid()) or (select public.is_admin()));

create or replace function private.notify_review_received() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_name text; v_role text;
begin
  if new.reviewed_user_id is null or new.reviewed_user_id = new.reviewer_id or new.deleted_at is not null then
    return new;
  end if;
  select coalesce(nullif(btrim(full_name), ''), 'Bir kullanıcı') into v_name from public.profiles where id = new.reviewer_id;
  v_role := case when new.type = 'seller' then 'ortak' else 'satıcı' end;
  begin
    insert into public.notifications (user_id, type, title, body, metadata)
    values (new.reviewed_user_id, 'review', 'Yeni değerlendirme aldın',
            coalesce(v_name, 'Bir kullanıcı') || ' (' || v_role || ') seni ' || new.rating || '★ ile değerlendirdi.',
            jsonb_build_object('listingId', new.listing_id, 'reviewId', new.id));
  exception when others then
    -- Bildirim yazılamasa da (hız sınırı vb.) değerlendirme kaydı korunur.
    null;
  end;
  return new;
end $$;
revoke all on function private.notify_review_received() from public, anon, authenticated;

drop trigger if exists notify_review_received on public.reviews;
create trigger notify_review_received after insert on public.reviews
  for each row execute function private.notify_review_received();

commit;
