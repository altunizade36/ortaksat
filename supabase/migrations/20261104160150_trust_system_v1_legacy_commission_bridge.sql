begin;
-- Existing commissions/orders remain the sole accounting records. The Trust row
-- adds bilateral confirmations and an agreement version; it is not a second debt.
create function trust_private.ensure_ledger(transaction_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.partnership_transactions;l public.listings;c public.commissions;order_id uuid;commission_id uuid;begin
 select * into t from public.partnership_transactions where id=transaction_id for update;
 if not found or t.sale_verified_at is null or t.seller_sale_confirmed_at is null or t.partner_sale_confirmed_at is null then raise exception 'TRUST_BILATERAL_SALE_REQUIRED';end if;
 if not trust_private.member(t,auth.uid()) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
 if t.legacy_commission_id is not null then
  select * into c from public.commissions where id=t.legacy_commission_id for update;
  if not found or c.deleted_at is not null or c.partnership_id<>t.partnership_id or c.listing_id<>t.listing_id or c.sale_amount is distinct from t.sale_amount or c.amount is distinct from t.commission_amount then raise exception 'TRUST_LEDGER_MISMATCH';end if;
  if c.status::text not in('approved','seller_paid') then raise exception 'TRUST_LEDGER_NOT_READY';end if;
  return;
 end if;
 select * into l from public.listings where id=t.listing_id for update;
 if not found or l.owner_id<>t.seller_id or l.status::text<>'active' or coalesce(l.stock_count,0)<1 then raise exception 'TRUST_STOCK_UNAVAILABLE';end if;
 order_id:=gen_random_uuid();commission_id:=gen_random_uuid();
 insert into public.orders(id,listing_id,seller_id,partnership_id,amount,status)
 values(order_id,t.listing_id,t.seller_id,t.partnership_id,t.sale_amount,'confirmed');
 insert into public.commissions(id,order_id,listing_id,partnership_id,amount,sale_amount,quantity,delivery_status,status,approved_at)
 values(commission_id,order_id,t.listing_id,t.partnership_id,t.commission_amount,t.sale_amount,1,'confirmed','approved',t.sale_verified_at);
 update public.partnership_transactions set legacy_commission_id=commission_id where id=t.id;
 update public.listings set stock_count=stock_count-1,status=case when stock_count<=1 then 'sold' else status end where id=l.id;
 perform trust_private.event(auth.uid(),t.id,'ledger_linked',jsonb_build_object('commissionId',commission_id,'orderId',order_id),'{}');
end $$;

create function trust_private.sync_ledger(transaction_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.partnership_transactions;c public.commissions;previous_setting text;begin
 select * into t from public.partnership_transactions where id=transaction_id;
 if t.legacy_commission_id is null or t.sale_amount is null then return;end if;
 if not trust_private.member(t,auth.uid()) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
 select * into c from public.commissions where id=t.legacy_commission_id for update;
 if not found or c.deleted_at is not null or c.amount is distinct from t.commission_amount or c.sale_amount is distinct from t.sale_amount then raise exception 'TRUST_LEDGER_MISMATCH';end if;
 previous_setting:=current_setting('trust_v1.ledger_write',true);
 perform set_config('trust_v1.ledger_write',t.id::text,true);
 -- A new allegation never erases an already confirmed payment in the ledger.
 if t.commission_status='seller_declared' and c.status::text<>'paid' then
  if (auth.uid()<>t.seller_id and not trust_private.staff(auth.uid())) or t.seller_payment_declared_at is null then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
  update public.commissions set status='seller_paid',seller_marked_paid_at=t.seller_payment_declared_at where id=c.id;
 elsif t.commission_status='mutual_confirmed' and c.status::text<>'paid' then
  if (auth.uid()<>t.partner_id and not trust_private.staff(auth.uid())) or t.partner_payment_confirmed_at is null or t.seller_payment_declared_at is null then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
  update public.commissions set status='paid',seller_marked_paid_at=t.seller_payment_declared_at,partner_confirmed_paid_at=t.partner_payment_confirmed_at,paid_at=t.partner_payment_confirmed_at where id=c.id;
 elsif t.commission_status='disputed' and c.status::text not in('paid','disputed') then
  update public.commissions set status='disputed' where id=c.id;
 elsif t.commission_status in('earned','awaiting_payment') and c.status::text='disputed' then
  -- Resolving an allegation restores the prior ledger state, never a payment.
  if not trust_private.staff(auth.uid()) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
  update public.commissions set status='approved' where id=c.id;
 end if;
 perform set_config('trust_v1.ledger_write',coalesce(previous_setting,''),true);
end $$;

-- Old payment endpoints cannot mutate a ledger record linked to a Trust case.
-- The trigger is INVOKER: authenticated clients cannot spoof a privileged caller
-- even if a session setting were set by some unrelated endpoint.
-- Execute the guard with a restricted read helper so authenticated clients do not
-- need SELECT privileges on the Trust tables just to update unrelated old sales.
create function trust_private.linked_transaction(commission_id uuid) returns uuid language sql stable security definer set search_path='' as $$select id from public.partnership_transactions t where legacy_commission_id=commission_id and (auth.uid() is null or trust_private.member(t,auth.uid()));$$;
create or replace function trust_private.guard_linked_ledger() returns trigger language plpgsql set search_path='' as $$
declare tx uuid:=trust_private.linked_transaction(old.id);owner_name text;begin
 if tx is not null and (to_jsonb(new)-array['payout_note']) is distinct from (to_jsonb(old)-array['payout_note']) then
  select pg_get_userbyid(p.proowner) into owner_name from pg_proc p where p.oid='trust_private.sync_ledger(uuid)'::regprocedure;
  if current_user<>owner_name or current_setting('trust_v1.ledger_write',true) is distinct from tx::text then raise exception 'TRUST_USE_TRANSACTION_CENTRE' using errcode='42501';end if;
 end if;
 return new;
end $$;
create trigger trust_guard_linked_ledger before update on public.commissions for each row execute function trust_private.guard_linked_ledger();
revoke all on function trust_private.ensure_ledger(uuid),trust_private.sync_ledger(uuid),trust_private.guard_linked_ledger(),trust_private.linked_transaction(uuid) from public,anon,authenticated;
grant execute on function trust_private.linked_transaction(uuid) to authenticated;
commit;
