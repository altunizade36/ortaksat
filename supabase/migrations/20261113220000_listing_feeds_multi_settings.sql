-- XML bağlantıları: satıcı başına BİRDEN ÇOK bağlantı + bağlantıya özel ayarlar (2026-11-13'te canlıya uygulandı).
--
-- settings (jsonb) alanları — istemci yazar, feed-sync okur:
--   createNew, syncContent, shortenTitles (boolean); commission (sayı); partnershipMode ('approval'|'open'|'none');
--   provinceId, districtId, location; defaultCategory ve categoryMap (akıştaki kategori metni → OrtakSat kategorisi:
--   { label, text, root, attrs, brandKey, image }). Kategori ağacı istemci kodunda olduğu için eşleme istemcide
--   çözülüp burada saklanır; sunucu ağacı bilmek zorunda kalmaz.

alter table public.listing_feeds drop constraint if exists listing_feeds_owner_id_key;
alter table public.listing_feeds add column if not exists name text not null default 'XML bağlantım';
alter table public.listing_feeds add column if not exists settings jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'listing_feeds_name_len') then
    alter table public.listing_feeds add constraint listing_feeds_name_len check (char_length(name) between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listing_feeds_settings_size') then
    alter table public.listing_feeds add constraint listing_feeds_settings_size check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 400000);
  end if;
end $$;

create unique index if not exists listing_feeds_owner_url on public.listing_feeds (owner_id, url);
create index if not exists idx_listing_feeds_owner on public.listing_feeds (owner_id);

-- Satıcı başına en çok 5 bağlantı.
create or replace function private.limit_listing_feeds()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select count(*) from public.listing_feeds where owner_id = new.owner_id) >= 5 then
    raise exception 'En fazla 5 XML bağlantısı kaydedebilirsin.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_limit_listing_feeds on public.listing_feeds;
create trigger trg_limit_listing_feeds before insert on public.listing_feeds
  for each row execute function private.limit_listing_feeds();

grant insert (owner_id, url, enabled, interval_hours, pause_missing, name, settings) on public.listing_feeds to authenticated;
grant update (url, enabled, interval_hours, pause_missing, next_run_at, updated_at, name, settings) on public.listing_feeds to authenticated;
