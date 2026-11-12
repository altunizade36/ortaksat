alter table public.blocked_users add column if not exists reason text check(reason is null or char_length(reason)<=120);
grant insert(reason) on public.blocked_users to authenticated;
-- Invoker trigger also covers joins executed through partner_join. The account
-- blocking policy cannot be bypassed by skipping the mobile form.
create or replace function private.mobile_blocked_partnership() returns trigger
language plpgsql security invoker set search_path='' as $$
declare seller uuid;
begin
 if new.status not in ('pending','active') then return new; end if;
 if tg_op='UPDATE' and old.status=new.status and old.listing_id=new.listing_id and old.partner_id=new.partner_id then return new; end if;
 select owner_id into seller from public.listings where id=new.listing_id;
 if seller is not null and public.is_blocked(seller,new.partner_id) then raise exception 'Engellenen hesaplar arasında yeni ortaklık işlemi yapılamaz.' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.mobile_blocked_partnership() from public,anon,authenticated;
create trigger mobile_blocked_partnership before insert or update of status,listing_id,partner_id on public.partnerships for each row execute function private.mobile_blocked_partnership();
create policy "blocked accounts cannot follow" on public.follows as restrictive for insert to authenticated with check(not public.is_blocked(follower_id,seller_id));
