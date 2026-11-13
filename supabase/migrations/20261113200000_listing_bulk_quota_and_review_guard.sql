-- İlan ekleme sınırı ve inceleme koruması (2026-11-13'te canlıya uygulandı).
--
-- 1) Toplu ilan yükleme saatte 100 ilanla sınırlıydı (throttle_inserts('owner_id','100','3600')): ekran parti
--    başına 200, XML akışı binlerce ürün kabul ederken 100'den sonraki her satır reddediliyordu. İncelemeye
--    düşen (pending_review) ilanlar için ayrı ve yüksek bir kota tanımlandı; doğrudan eklenen ilanlarda sınır aynı.
-- 2) İncelemedeki/reddedilen ilan, sahibi tarafından önce taslağa sonra aktife alınarak yönetici onayı olmadan
--    yayınlanabiliyordu. Sahibi artık bu ilanın durumunu yalnız yeniden incelemeye gönderebilir ya da arşivleyebilir.

CREATE OR REPLACE FUNCTION public.guard_listing_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verdict text;
begin
  -- service_role / sunucu (auth.uid null) ve admin/moderatör içerik taramasından muaf.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  -- (KORUNAN mevcut kural) UPDATE: incelemedeki/reddedilen ilan admin olmadan aktife alınamaz.
  -- İncelemedeki/reddedilen ilanın durumunu sahibi yalnız "yeniden incelemeye gönder" ya da "arşivle" yapabilir.
  -- Eskiden yalnız doğrudan aktife alma engelliydi: önce taslağa/pasife, sonra aktife alınarak inceleme
  -- atlatılabiliyordu (2026-11-13'te test hesabıyla doğrulandı).
  if tg_op = 'UPDATE'
     and old.status in ('pending_review', 'rejected')
     and new.status is distinct from old.status
     and new.status not in ('pending_review', 'archived') then
    raise exception 'Bu ilan incelemede; yayina almak icin admin onayi gerekir';
  end if;

  -- Arşiv, ilan sahibi için son duraktır: arşivlenen ilan yeniden yayına alınamaz (yoksa inceleme
  -- "incelemede → arşiv → aktif" yoluyla yine atlatılırdı). İstemcide arşivden geri alma akışı yoktur.
  if tg_op = 'UPDATE' and old.status = 'archived' and new.status is distinct from 'archived' then
    raise exception 'Arsivlenen ilan yeniden yayina alinamaz; yeni bir ilan olusturun.';
  end if;

  -- (YENİ) İÇERİK TARAMASI — INSERT ve içerik/aktivasyon değişen UPDATE'lerde sunucuda zorlanır.
  if tg_op = 'INSERT'
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or (new.status = 'active' and old.status is distinct from 'active') then
    v_verdict := public.scan_prohibited(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
    if v_verdict = 'block' then
      raise exception 'Yasakli urun/hizmet iceren ilan yayinlanamaz (silah, uyusturucu, sahte belge vb.).';
    elsif v_verdict = 'review' and new.status = 'active' then
      new.status := 'pending_review';  -- aktif yapilmaz → incelemeye duser
    end if;
  end if;

  return new;
end;
$function$;

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
  if new.status = 'pending_review' then
    -- TOPLU YÜKLEME kotası: bu ilanlar yayına girmeden yönetici incelemesine düşer ve sahibi durumlarını
    -- değiştiremez (guard_listing_moderation). Katalog yükleyebilmek için sınır yüksektir.
    select count(*) into v_count from public.listings
      where owner_id = new.owner_id and created_at > now() - interval '1 hour';
    if v_count >= 2000 then
      raise exception 'Saatlik toplu ilan sınırına (2000) ulaştınız; kalan ürünleri bir saat sonra yükleyin.'
        using errcode = 'P0001';
    end if;
  else
    -- Doğrudan eklenen ilanlar (aktif/taslak): saatte 100. İncelemeye düşen toplu ilanlar bu sayıma girmez.
    select count(*) into v_count from public.listings
      where owner_id = new.owner_id and status <> 'pending_review' and created_at > now() - interval '1 hour';
    if v_count >= 100 then
      raise exception 'Çok fazla işlem yaptınız; lütfen biraz bekleyip tekrar deneyin.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_throttle_listings on public.listings;
create trigger trg_throttle_listings before insert on public.listings
  for each row execute function private.throttle_listing_inserts();
