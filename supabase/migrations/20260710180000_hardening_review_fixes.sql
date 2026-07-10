-- Review düzeltmeleri (para-akışı):
-- 1) record_sale keyfi p_status kabul ediyordu → satıcı komisyonu doğrudan 'paid' ekleyip
--    bump_seller_successful_sales ile güven puanı şişirebiliyordu (paid-guard yalnız UPDATE'ti).
--    Artık yalnız 'return_pending'/'approved' ile oluşturulur.
-- 2) paid-guard artık INSERT'te de çalışır (doğrudan REST ile 'paid' insert de kapanır).
-- 3) record_payout: TOCTOU giderildi — tutar/sayım GÜNCELLENEN satırlardan (UPDATE...RETURNING) hesaplanır.

-- 1) record_sale: başlangıç durumu whitelist
create or replace function public.record_sale(
  p_commission_id uuid, p_order_id uuid, p_listing_id uuid, p_partnership_id uuid, p_lead_id uuid,
  p_commission_amount numeric, p_sale_amount numeric, p_quantity int, p_buyer_name text,
  p_delivery_status text, p_return_until date, p_status text, p_approved_at timestamptz, p_payout_note text
) returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_stock int; v_listing_status text; v_part_status text;
begin
  if p_status not in ('return_pending', 'approved') then
    raise exception 'Invalid initial commission status'; -- 'paid' vb. ile doğrudan oluşturma yasak
  end if;
  select owner_id, stock_count, status::text into v_owner, v_stock, v_listing_status
    from listings where id = p_listing_id for update;
  if v_owner is null then raise exception 'Listing not found'; end if;
  if auth.uid() is not null and auth.uid() <> v_owner then raise exception 'Only the listing owner can record a sale'; end if;
  if v_listing_status <> 'active' then raise exception 'Listing not active'; end if;
  if p_quantity < 1 then raise exception 'Quantity must be >= 1'; end if;
  if v_stock < p_quantity then raise exception 'Insufficient stock'; end if;
  select status::text into v_part_status from partnerships where id = p_partnership_id;
  if v_part_status is distinct from 'active' then raise exception 'Partnership not active'; end if;
  if p_lead_id is not null and exists (select 1 from leads where id = p_lead_id and status = 'converted') then
    raise exception 'Lead already converted';
  end if;

  insert into orders (id, listing_id, seller_id, partnership_id, amount, status)
    values (p_order_id, p_listing_id, v_owner, p_partnership_id, p_sale_amount, 'confirmed'::order_status);
  insert into commissions (id, order_id, listing_id, partnership_id, lead_id, amount, sale_amount,
    quantity, buyer_name, delivery_status, return_until, status, approved_at, payout_note)
    values (p_commission_id, p_order_id, p_listing_id, p_partnership_id, p_lead_id, p_commission_amount,
    p_sale_amount, p_quantity, p_buyer_name, coalesce(p_delivery_status, 'confirmed')::order_status,
    p_return_until, p_status::commission_status, p_approved_at, p_payout_note);
  update listings set stock_count = stock_count - p_quantity,
    status = case when stock_count - p_quantity <= 0 then 'sold'::listing_status else status end
    where id = p_listing_id;
  if p_lead_id is not null then update leads set status = 'converted'::lead_status where id = p_lead_id; end if;
end $$;

-- 2) paid-guard INSERT'te de çalışsın (doğrudan 'paid' insert bypass'ı kapat).
--    coalesce(old.status,'') INSERT'te '' → enum cast hatası veriyordu; TG_OP ile düzeltildi.
create or replace function public.guard_commission_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_partner uuid; v_role text;
begin
  if new.status = 'paid'
     and (tg_op = 'INSERT' or old.status is distinct from 'paid')
     and auth.uid() is not null then
    select p.partner_id into v_partner from public.partnerships p where p.id = new.partnership_id;
    select role into v_role from public.profiles where id = auth.uid();
    if auth.uid() <> coalesce(v_partner, '00000000-0000-0000-0000-000000000000'::uuid)
       and coalesce(v_role, 'user') not in ('admin', 'moderator', 'super_admin') then
      raise exception 'Komisyon ödeme onayı (paid) yalnız ortak tarafından yapılabilir.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_commission_paid on public.commissions;
create trigger trg_guard_commission_paid
  before insert or update on public.commissions
  for each row execute function public.guard_commission_paid();

-- 3) record_payout: TOCTOU giderildi (UPDATE...RETURNING'den hesapla)
create or replace function public.record_payout(p_partner_id uuid, p_listing_id uuid, p_note text)
returns table(r_payout_id uuid, r_amount numeric, r_count integer)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_payout uuid; v_amount numeric := 0; v_count integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  insert into public.payouts (seller_id, partner_id, listing_id, amount, commission_count, note)
    values (v_uid, p_partner_id, p_listing_id, 0, 0, p_note) returning id into v_payout;
  with upd as (
    update public.commissions c
      set status = 'seller_paid', seller_marked_paid_at = now(), payout_id = v_payout
      from public.listings l, public.partnerships pt
      where c.listing_id = l.id and c.partnership_id = pt.id
        and l.owner_id = v_uid and pt.partner_id = p_partner_id
        and (p_listing_id is null or c.listing_id = p_listing_id)
        and c.status in ('return_pending', 'approved')
      returning c.amount
  )
  select coalesce(sum(amount), 0), count(*) into v_amount, v_count from upd;
  if v_count = 0 then raise exception 'No owed commissions to pay'; end if;
  update public.payouts set amount = v_amount, commission_count = v_count where id = v_payout;
  return query select v_payout, v_amount, v_count;
end $$;
