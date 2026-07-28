-- Yeni ilan yayına çıkınca IndexNow'a otomatik bildirim (SEO tazeliği).
-- Insert active VEYA status->active olunca IndexNow API'sine POST → Bing/Yandex
-- ilanı anında tarar (Google build-time sitemap + crawl ile keşfeder). pg_net async;
-- fail-safe (exception when others → return new) → bildirim hatası insert'i bloklamaz.
-- Bkz: scripts/indexnow.mjs (build-time toplu ping), scripts/generate-sitemap.mjs.

create or replace function public.notify_indexnow_on_listing()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.status = 'active' and coalesce(new.demo, false) = false
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform net.http_post(
      url := 'https://api.indexnow.org/indexnow',
      headers := jsonb_build_object('Content-Type', 'application/json; charset=utf-8'),
      body := jsonb_build_object(
        'host', 'www.ortaksat.com',
        'key', 'c9960a5a57f68fb0719edae8dfc9e0e8',
        'keyLocation', 'https://www.ortaksat.com/c9960a5a57f68fb0719edae8dfc9e0e8.txt',
        'urlList', jsonb_build_array('https://www.ortaksat.com/listing/' || new.id::text)
      )
    );
  end if;
  return new;
exception when others then
  return new;
end;
$fn$;

drop trigger if exists trg_indexnow_listing on public.listings;
create trigger trg_indexnow_listing
after insert or update of status on public.listings
for each row execute function public.notify_indexnow_on_listing();
