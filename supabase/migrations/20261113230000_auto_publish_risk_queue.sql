-- Otomatik yayın + riskli ilan kuyruğu (2026-11-13'te canlıya uygulandı).
--
-- Platform sahibinin kararı: toplu ve XML ile gelen ilanlar da yönetici onayı beklemeden YAYINLANIR; yalnız
-- otomatik taramaya takılanlar ("riskli") incelemeye düşer ve yöneticilere bildirim gider.
--
-- 1) İlan ekleme sınırı tek kota: sahibi başına saatte 2000 (toplu/XML yüklemeler artık doğrudan yayına girdiği
--    için "incelemeye düşenlere ayrı kota" ayrımı kalktı).
-- 2) guard_listing_moderation: taramaya takılan ilan incelemeye düşerken NEDENİ attributes._reviewReason'a yazılır.
--    (İnceleme atlatma korumaları — incelemedeki/arşivdeki ilanın sahibince yayına alınamaması — aynen durur.)
-- 3) Riskli ilan incelemeye düşünce yöneticilere bildirim (yarım saatte en çok bir kez; e-posta bildirimi
--    mevcut bildirim → e-posta tetikleyicisinden gider).
-- 4) Takipçi bildirimi: aynı satıcı için takipçiye 6 saatte en çok bir "yeni ilan" bildirimi (yüzlerce ilan
--    birden yayınlanınca takipçiler bildirim yağmuruna tutulmasın).

create or replace function private.throttle_listing_inserts()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count int;
begin
  -- service_role/sistem (auth.uid null) ve admin/moderatör muaf.
  if auth.uid() is null or public.is_admin() or new.owner_id is null then
    return new;
  end if;
  select count(*) into v_count from public.listings
    where owner_id = new.owner_id and created_at > now() - interval '1 hour';
  if v_count >= 2000 then
    raise exception 'Saatlik ilan sınırına (2000) ulaştınız; kalan ürünleri bir saat sonra yükleyin.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

create or replace function public.guard_listing_moderation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verdict text;
begin
  -- service_role / sunucu (auth.uid null) ve admin/moderatör içerik taramasından muaf.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  -- İncelemedeki/reddedilen ilanın durumunu sahibi yalnız "yeniden incelemeye gönder" ya da "arşivle" yapabilir.
  if tg_op = 'UPDATE'
     and old.status in ('pending_review', 'rejected')
     and new.status is distinct from old.status
     and new.status not in ('pending_review', 'archived') then
    raise exception 'Bu ilan incelemede; yayina almak icin admin onayi gerekir';
  end if;

  -- Arşiv, ilan sahibi için son duraktır (yoksa inceleme "incelemede → arşiv → aktif" yoluyla atlatılırdı).
  if tg_op = 'UPDATE' and old.status = 'archived' and new.status is distinct from 'archived' then
    raise exception 'Arsivlenen ilan yeniden yayina alinamaz; yeni bir ilan olusturun.';
  end if;

  -- İÇERİK TARAMASI — INSERT ve içerik/aktivasyon değişen UPDATE'lerde sunucuda zorlanır.
  if tg_op = 'INSERT'
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or (new.status = 'active' and old.status is distinct from 'active') then
    v_verdict := public.scan_prohibited(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
    if v_verdict = 'block' then
      raise exception 'Yasakli urun/hizmet iceren ilan yayinlanamaz (silah, uyusturucu, sahte belge vb.).';
    elsif v_verdict = 'review' and new.status = 'active' then
      new.status := 'pending_review';  -- riskli: yayına alınmaz, inceleme kuyruğuna düşer
      new.attributes := coalesce(new.attributes, '{}'::jsonb)
        || jsonb_build_object('_reviewReason', 'Otomatik tarama: başlık ya da açıklama inceleme gerektiren bir ifade içeriyor.');
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.notify_admins_listing_review()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'pending_review' and (tg_op = 'INSERT' or old.status is distinct from 'pending_review') then
    insert into public.notifications (user_id, type, title, body, metadata)
    select p.id, 'system', 'İncelenmesi gereken ilan var',
           format('"%s" ilanı otomatik taramaya takıldığı için yayına alınmadı. Yönetim panelindeki inceleme kuyruğundan kontrol et.', left(new.title, 60)),
           jsonb_build_object('listingId', new.id, 'kind', 'listing_review')
    from public.profiles p
    where p.role in ('admin', 'super_admin', 'moderator') and p.status = 'active'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.metadata ->> 'kind' = 'listing_review' and n.created_at > now() - interval '30 minutes'
      );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_admins_listing_review on public.listings;
create trigger trg_notify_admins_listing_review after insert or update of status on public.listings
  for each row execute function private.notify_admins_listing_review();

-- Takipçi bildirimi (6 saatte bir sınırı eklendi)
CREATE OR REPLACE FUNCTION public.notify_followers_new_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Yalnızca İLK yayın: doğrudan aktif INSERT veya taslak/inceleme→aktif geçiş.
  -- (paused→active yeniden yayını takipçilere "yeni ilan" gibi spam olmasın.)
  if new.status = 'active' and (tg_op = 'INSERT' or old.status in ('draft', 'pending_review')) then
    insert into public.notifications (user_id, type, title, body, metadata)
    select fl.follower_id, 'follow', 'Takip ettiğin satıcıdan yeni ilan',
           format('Takip ettiğin bir satıcı "%s" ilanını yayınladı.', private.display_listing_title(new.title)),
           jsonb_build_object('listingId', new.id, 'sellerId', new.owner_id)
    from public.follows fl
    where fl.seller_id = new.owner_id and fl.follower_id <> new.owner_id
      -- Aynı satıcı için takipçiye 6 saatte en çok bir bildirim (toplu yayınlarda bildirim yağmuru olmasın).
      and not exists (
        select 1 from public.notifications n
        where n.user_id = fl.follower_id and n.type = 'follow' and n.metadata ->> 'sellerId' = new.owner_id::text
          and n.created_at > now() - interval '6 hours'
      );
  end if;
  return new;
end $function$;
