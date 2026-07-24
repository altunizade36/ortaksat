-- Y4 — SUNUCU-TARAFI RATE-LIMIT (spam/DoS koruması)
-- Sorun (denetim): check_rate_limit VAR ama İSTEMCİ çağırıyor (atlatılabilir). Referans
--   tık/lead throttle'ları BEFORE INSERT trigger ile SUNUCUDA zorlanıyor; ama messages,
--   listings, reports, reviews'de böyle bir trigger YOK → doğrudan API ile sınırsız
--   mesaj/ilan/şikayet/yorum basılabiliyordu (spam, taciz, sahte-yorum, DoS).
-- Çözüm: aynı sunucu-zorlamalı pattern'i generic bir trigger ile bu 4 tabloya uygula.
--   service_role/sistem (auth.uid null) ve admin/moderatör MUAF. Limitler legit kullanımı
--   (aktif sohbet, toplu CSV ilan) bozmayacak kadar cömert; blast-spam'i keser.

-- Generic throttle: TG_ARGV[0]=aktör kolonu, [1]=limit, [2]=pencere(saniye).
create or replace function private.throttle_inserts()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_col text := tg_argv[0];
  v_limit int := tg_argv[1]::int;
  v_window int := tg_argv[2]::int;
  v_actor uuid;
  v_count int;
begin
  -- service_role/sistem (auth.uid null) ve admin/moderatör muaf.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  -- NEW satırından aktör kolonunu dinamik oku.
  execute format('select ($1).%I', v_col) into v_actor using new;
  if v_actor is null then
    return new;
  end if;
  -- Aynı aktörün pencere içindeki INSERT sayısı.
  execute format(
    'select count(*) from public.%I where %I = $1 and created_at > now() - make_interval(secs => $2)',
    tg_table_name, v_col
  ) into v_count using v_actor, v_window;
  if v_count >= v_limit then
    raise exception 'Çok fazla işlem yaptınız; lütfen biraz bekleyip tekrar deneyin.'
      using errcode = 'P0001';
  end if;
  return new;
end
$fn$;

-- messages: gönderen başına 100 / 5 dk (aktif sohbet rahat; toplu spam kesilir).
drop trigger if exists trg_throttle_messages on public.messages;
create trigger trg_throttle_messages
  before insert on public.messages
  for each row execute function private.throttle_inserts('sender_id', '100', '300');

-- listings: ilan sahibi başına 100 / saat (toplu CSV import geçer; binlerce-spam kesilir).
drop trigger if exists trg_throttle_listings on public.listings;
create trigger trg_throttle_listings
  before insert on public.listings
  for each row execute function private.throttle_inserts('owner_id', '100', '3600');

-- reports: şikayetçi başına 20 / saat (şikayet-spam/taciz kesilir).
drop trigger if exists trg_throttle_reports on public.reports;
create trigger trg_throttle_reports
  before insert on public.reports
  for each row execute function private.throttle_inserts('reporter_id', '20', '3600');

-- reviews: yorumcu başına 15 / saat (sahte-yorum yağmuru kesilir).
drop trigger if exists trg_throttle_reviews on public.reviews;
create trigger trg_throttle_reviews
  before insert on public.reviews
  for each row execute function private.throttle_inserts('reviewer_id', '15', '3600');
