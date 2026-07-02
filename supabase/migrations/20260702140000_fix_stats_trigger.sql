-- KRİTİK DÜZELTME: private.refresh_listing_public_stats_trigger() paylaşımlı bir
-- trigger fonksiyonuydu ve her zaman new.listing_id'e erişmeye çalışıyordu.
-- 'listings' tablosunda listing_id kolonu YOK (id var); bu yüzden listings'e her
-- INSERT/UPDATE "record new has no field listing_id" hatasıyla düşüyordu ->
-- uygulamadan verilen ilanlar Supabase'e hiç kaydolmuyordu.
-- Çözüm: tabloya göre doğru kimlik kolonunu seç (TG_TABLE_NAME).
create or replace function private.refresh_listing_public_stats_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target_listing_id uuid;
begin
  if tg_table_name = 'listings' then
    target_listing_id := coalesce(new.id, old.id);
  else
    target_listing_id := coalesce(new.listing_id, old.listing_id);
  end if;
  perform private.refresh_listing_public_stats(target_listing_id);
  return coalesce(new, old);
end;
$function$;
