-- Atomik satış kaydı: order + commission + stok düşümü + lead-dönüşümü TEK işlemde.
-- Eskiden istemci bunları 3 ayrı yazımla yapıyordu; commission insert'i başarısız olursa
-- DB'de yetim order + yanlış stok kalıyordu (denetim HIGH). Bu fonksiyon = tek transaction:
-- herhangi bir adım hata verirse hepsi geri alınır. Platform PARA TUTMAZ — bu yalnız kayıt.
create or replace function public.record_sale(
  p_commission_id uuid,
  p_order_id uuid,
  p_listing_id uuid,
  p_partnership_id uuid,
  p_lead_id uuid,
  p_commission_amount numeric,
  p_sale_amount numeric,
  p_quantity int,
  p_buyer_name text,
  p_delivery_status text,
  p_return_until date,
  p_status text,
  p_approved_at timestamptz,
  p_payout_note text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_stock int;
  v_listing_status text;
  v_part_status text;
begin
  select owner_id, stock_count, status::text into v_owner, v_stock, v_listing_status
    from listings where id = p_listing_id for update;
  if v_owner is null then raise exception 'Listing not found'; end if;
  -- Satışı yalnız ilan sahibi kaydeder (service_role/admin auth.uid() null → serbest).
  if auth.uid() is not null and auth.uid() <> v_owner then
    raise exception 'Only the listing owner can record a sale';
  end if;
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

  update listings
    set stock_count = stock_count - p_quantity,
        status = case when stock_count - p_quantity <= 0 then 'sold'::listing_status else status end
    where id = p_listing_id;

  if p_lead_id is not null then
    update leads set status = 'converted'::lead_status where id = p_lead_id;
  end if;
end;
$$;

grant execute on function public.record_sale(uuid, uuid, uuid, uuid, uuid, numeric, numeric, int, text, text, date, text, timestamptz, text) to authenticated, service_role;
