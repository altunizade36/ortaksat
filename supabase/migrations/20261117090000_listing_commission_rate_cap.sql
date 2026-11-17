-- Yüzde komisyon 90'ı aşamaz (istemcideki listingCommissionError ile aynı kural).
-- Canlıda "%350" / "%100" oranlı ilanlar vardı (satıcı büyük olasılıkla ₺ yazmak isterken yüzde seçmiş).
-- CHECK kısıtı yerine tetikleyici: mevcut satırların ilgisiz güncellemeleri (görüntülenme vb.) bozulmasın;
-- yalnız komisyon yeni yazılırken / değiştirilirken denetlenir. Mevcut veriye dokunulmaz.
create or replace function public.enforce_listing_commission_rate_cap()
returns trigger
language plpgsql
as $$
begin
  if new.commission_type::text = 'rate'
     and new.commission_value > 90
     and (tg_op = 'INSERT'
          or new.commission_value is distinct from old.commission_value
          or new.commission_type is distinct from old.commission_type) then
    raise exception 'Yüzde komisyon 90 değerini aşamaz.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists listing_commission_rate_cap on public.listings;
create trigger listing_commission_rate_cap
  before insert or update of commission_type, commission_value on public.listings
  for each row execute function public.enforce_listing_commission_rate_cap();
