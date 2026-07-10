-- Komisyon 'paid' (ödeme onayı) yalnız ORTAK tarafından yapılabilir.
-- Eskiden "listing owner manages commissions FOR ALL" RLS'i satıcının doğrudan REST ile
-- status='paid' + istediği amount göndermesine izin veriyordu; bump_seller_successful_sales
-- tetikleyicisi de satıcının güven puanını şişiriyordu (tek gerçek ortak yeterliydi).
-- İstisnalar: partner'ın kendisi, admin/moderatör (uyuşmazlık çözümü), service_role (auth.uid() null).
create or replace function public.guard_commission_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner uuid;
  v_role text;
begin
  if new.status = 'paid' and coalesce(old.status, '') is distinct from 'paid' and auth.uid() is not null then
    select p.partner_id into v_partner from public.partnerships p where p.id = new.partnership_id;
    select role into v_role from public.profiles where id = auth.uid();
    if auth.uid() <> coalesce(v_partner, '00000000-0000-0000-0000-000000000000'::uuid)
       and coalesce(v_role, 'user') not in ('admin', 'moderator', 'super_admin') then
      raise exception 'Komisyon ödeme onayı (paid) yalnız ortak tarafından yapılabilir.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_commission_paid on public.commissions;
create trigger trg_guard_commission_paid
  before update on public.commissions
  for each row execute function public.guard_commission_paid();
