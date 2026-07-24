-- K2 — SUNUCU-TARAFI İÇERİK MODERASYONU
-- Sorun (denetim): scan_prohibited (içerik tarayıcı) + guard_listing_moderation VAR, ama
--   guard YALNIZ BEFORE UPDATE'te çalışıyor ve YALNIZ status-geçişini koruyor — İÇERİK TARAMIYOR.
--   INSERT'te hiçbir moderasyon trigger'ı yok → doğrudan REST/API ile status='active' + yasaklı
--   içerik (silah/uyuşturucu/sahte belge) ilan YAYINLANABİLİYORDU (istemci taraması atlatılabilir).
-- Çözüm: guard'ı INSERT+UPDATE'te scan_prohibited ile içerik taramasına genişlet.
--   block  → INSERT reddedilir (yasaklı ilan hiç oluşmaz).
--   review → status ZORLA 'pending_review' (aktif yapılamaz; admin onayı gerekir).
-- Normal istemci akışı zaten block'u engelliyor / review'i pending_review yapıyor → REGRESYON YOK;
-- bu yalnız API-atlatma vektörünü kapatır (savunma derinliği). service_role (auth.uid null) ve
-- admin muaf (seed + moderasyon yayına-alma).

create or replace function public.guard_listing_moderation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_verdict text;
begin
  -- service_role / sunucu (auth.uid null) ve admin/moderatör içerik taramasından muaf.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  -- (KORUNAN mevcut kural) UPDATE: incelemedeki/reddedilen ilan admin olmadan aktife alınamaz.
  if tg_op = 'UPDATE'
     and old.status in ('pending_review', 'rejected')
     and new.status = 'active' then
    raise exception 'Bu ilan incelemede; yayina almak icin admin onayi gerekir';
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
$fn$;

-- Trigger'ı INSERT'i de kapsayacak şekilde yeniden kur.
drop trigger if exists trg_guard_listing_moderation on public.listings;
create trigger trg_guard_listing_moderation
  before insert or update on public.listings
  for each row execute function public.guard_listing_moderation();
