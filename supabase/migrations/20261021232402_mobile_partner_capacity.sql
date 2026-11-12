create or replace function private.mobile_partner_capacity()
returns trigger language plpgsql security definer set search_path='' as $$
declare attrs jsonb; cap numeric; active_count bigint; target uuid;
begin
  if auth.uid() is null and coalesce(auth.role(),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'Giriş gerekli.' using errcode='42501'; end if;
  if tg_table_name='partnerships' then
    if new.status<>'active' or (tg_op='UPDATE' and old.status='active' and old.listing_id=new.listing_id) then return new; end if;
    target:=new.listing_id;
    -- All activations for a listing serialize on the same row. Listing edits
    -- already hold this row lock, so capacity edits use the same lock order.
    select l.attributes into attrs from public.listings l where l.id=target for update;
  else
    target:=new.id;attrs:=new.attributes;
  end if;
  if nullif(attrs->>'_maxPartners','') is null then return new; end if;
  if (attrs->>'_maxPartners') !~ '^[0-9]+$' then raise exception 'Maksimum ortak sayısı pozitif tam sayı olmalı.' using errcode='22023'; end if;
  cap:=(attrs->>'_maxPartners')::numeric;
  if cap<1 or cap>2147483647 then raise exception 'Maksimum ortak sayısı geçersiz.' using errcode='22023'; end if;
  if tg_table_name='partnerships' then
    select count(*) into active_count from public.partnerships p where p.listing_id=target and p.status='active' and p.id<>new.id;
    if active_count>=cap then raise exception 'Bu ilanın ortaklık kontenjanı dolu.' using errcode='23514'; end if;
  else
    select count(*) into active_count from public.partnerships p where p.listing_id=target and p.status='active';
    if active_count>cap then raise exception 'Kontenjan aktif ortak sayısından az olamaz.' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function private.mobile_partner_capacity() from public,anon,authenticated;
drop trigger if exists mobile_partner_capacity on public.partnerships;
create trigger mobile_partner_capacity before insert or update of status,listing_id on public.partnerships for each row execute function private.mobile_partner_capacity();
drop trigger if exists mobile_listing_capacity on public.listings;
create trigger mobile_listing_capacity before update of attributes on public.listings for each row execute function private.mobile_partner_capacity();
