-- New/edited titles only. Preserve legacy originals and unrelated updates.
create or replace function private.validate_listing_title()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare
 raw_title text := normalize(coalesce(new.title, ''), NFC);
 clean_title text;
begin
 if TG_OP = 'UPDATE' and new.title is not distinct from old.title then return new; end if;
 raw_title := replace(raw_title, chr(160), ' ');
 clean_title := btrim(regexp_replace(raw_title, ' +', ' ', 'g'));
 if raw_title ~ U&'[\FE00-\FE0F\20D0-\20FF]' or raw_title ~ '[^[:alpha:][:digit:]²³ .,''’"()/:+&%-]' then
   raise exception using errcode = '22023', message = 'Başlıkta emoji, ok, yıldız, süsleme veya görünmez karakter kullanmayın. Harf, rakam ve anlamlı noktalama kullanın.';
 end if;
 if clean_title ~ '[.,''’"()/:+&%-]{3,}' then
   raise exception using errcode = '22023', message = 'Noktalama işaretlerini art arda kullanmayın. Başlığı sade ve okunaklı yazın.';
 end if;
 if char_length(clean_title) < 10 or char_length(clean_title) > 70 then
   raise exception using errcode = '22023', message = 'Başlık 10–70 karakter olmalı. Lütfen başlığı düzenleyin.';
 end if;
 if clean_title !~ '[[:alpha:][:digit:]]' then
   raise exception using errcode = '22023', message = 'Başlıkta ürününüzü tanımlayan harf veya rakam bulunmalı.';
 end if;
 new.title := clean_title;
 return new;
end;
$fn$;
revoke all on function private.validate_listing_title() from public, anon, authenticated;
drop trigger if exists listing_title_policy on public.listings;
create trigger listing_title_policy before insert or update of title on public.listings
for each row execute function private.validate_listing_title();
