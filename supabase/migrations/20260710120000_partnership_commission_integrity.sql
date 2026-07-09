-- Ortaklık/komisyon bütünlüğü sertleştirmesi (denetim bulguları).
-- 1) Bir lead en fazla bir komisyona dönüşebilir: istemci-tarafı "bir kez dönüştür"
--    kontrolü iki sekme/cihazda çift komisyon + çift stok düşüşü üretebiliyordu.
create unique index if not exists commissions_lead_id_unique
  on public.commissions (lead_id) where lead_id is not null;

-- 2) Onay (approval) modunda ortak, doğrudan REST POST ile status='active' göndererek
--    satıcı onayını atlayabiliyordu. Trigger, approval ilanında yeni ortaklığı 'pending'e
--    zorlar. ('open' anında aktif kalır; 'invite' kodu istemcide doğrulanır — dokunmuyoruz.)
create or replace function public.enforce_partnership_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare l_mode text;
begin
  select partnership_mode into l_mode from public.listings where id = new.listing_id;
  if new.status = 'active' and coalesce(l_mode, 'approval') = 'approval' then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_partnership_approval on public.partnerships;
create trigger trg_enforce_partnership_approval
  before insert on public.partnerships
  for each row execute function public.enforce_partnership_approval();
