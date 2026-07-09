-- Satıcının "başarılı satış" sayısı (ödenmiş komisyon adedi) profillerde denormalize
-- tutulur; her sayfada komisyon sayımı yapmak yerine trigger ile bakımı yapılır.
-- Etkilenen: kart/detaydaki "N satış", güven-puanı (trust-score) — önceden hep 0'dı.
alter table profiles add column if not exists successful_sales integer not null default 0;

-- Geriye dönük doldur: her satıcının ödenmiş (paid) komisyon adedi.
update profiles p set successful_sales = coalesce(sub.c, 0)
from (
  select l.owner_id, count(*)::int c
  from commissions cm join listings l on l.id = cm.listing_id
  where cm.status = 'paid'
  group by l.owner_id
) sub
where p.id = sub.owner_id;

-- Komisyon "paid" olduğunda ilgili satıcının sayacını artır (idempotent geçiş).
create or replace function bump_seller_successful_sales() returns trigger
  language plpgsql security definer set search_path = public as $$
declare seller uuid;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select owner_id into seller from listings where id = new.listing_id;
    if seller is not null then
      update profiles set successful_sales = successful_sales + 1 where id = seller;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_seller_successful_sales on commissions;
create trigger trg_bump_seller_successful_sales after insert or update of status on commissions
  for each row execute function bump_seller_successful_sales();
