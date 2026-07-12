-- OrtakSat — CATCH-UP: iki-taraflı satış doğrulaması (buyer confirm)
-- Bu nesneler canlıya doğrudan DDL ile eklenmişti (migration dosyası yoktu → şema kayması).
-- Bu dosya repo'yu canlıyla eşitler; TAMAMEN idempotent → felaket kurtarma / temiz kurulum için.
-- (Canlıda zaten mevcut olduğundan tekrar uygulanması güvenlidir.)

-- 1) commission_status enum değerleri (0001'deki temel set: pending/approved/paid).
alter type public.commission_status add value if not exists 'return_pending';
alter type public.commission_status add value if not exists 'seller_paid';
alter type public.commission_status add value if not exists 'cancelled';
alter type public.commission_status add value if not exists 'disputed';

-- 2) Alıcı-onay kolonları (login gerektirmeyen token'lı onay için).
alter table public.commissions add column if not exists buyer_confirm_token  text;
alter table public.commissions add column if not exists buyer_confirmed_at    timestamptz;
alter table public.commissions add column if not exists buyer_confirm_status  text;
create index if not exists idx_commissions_buyer_confirm_token on public.commissions(buyer_confirm_token) where buyer_confirm_token is not null;

-- 3) Alıcı satış-onay RPC'leri (SECURITY DEFINER; token ile yetkilendirir, login YOK).
create or replace function public.sale_confirm_info(p_token text)
returns table(product_title text, amount numeric, seller_name text, status text, confirmed boolean, created_at timestamptz)
language sql security definer set search_path to 'public' as $$
  select l.title, c.sale_amount, pr.full_name,
         coalesce(c.buyer_confirm_status,'awaiting'), c.buyer_confirmed_at is not null, c.created_at
  from public.commissions c
  join public.listings l on l.id = c.listing_id
  left join public.profiles pr on pr.id = l.owner_id
  where c.buyer_confirm_token = p_token and c.deleted_at is null
  limit 1;
$$;

create or replace function public.confirm_sale(p_token text, p_action text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_confirmed timestamptz; v_listing uuid; v_partnership uuid; v_owner uuid; v_partner uuid; v_title text;
begin
  select id, buyer_confirmed_at, listing_id, partnership_id into v_id, v_confirmed, v_listing, v_partnership
    from public.commissions where buyer_confirm_token = p_token and deleted_at is null limit 1;
  if v_id is null then return 'not_found'; end if;
  select owner_id, title into v_owner, v_title from public.listings where id = v_listing;
  select partner_id into v_partner from public.partnerships where id = v_partnership;
  if p_action = 'confirm' then
    if v_confirmed is not null then return 'already'; end if;
    update public.commissions set buyer_confirmed_at = now(), buyer_confirm_status = 'confirmed' where id = v_id;
    if v_owner is not null then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_owner, 'sale', 'Alıcı satışı onayladı', coalesce(v_title,'İlan') || ' için alıcı alışverişi onayladı — komisyon doğrulandı.', false, '{}'::jsonb); end if;
    if v_partner is not null and v_partner <> v_owner then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_partner, 'sale', 'Alıcı satışı onayladı', coalesce(v_title,'İlan') || ' için alıcı onayı geldi — komisyonun doğrulandı.', false, '{}'::jsonb); end if;
    return 'confirmed';
  elsif p_action = 'dispute' then
    update public.commissions set buyer_confirm_status = 'disputed', status = 'disputed' where id = v_id;
    if v_owner is not null then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_owner, 'sale', 'Alıcı satışa itiraz etti', coalesce(v_title,'İlan') || ' için alıcı bir sorun bildirdi. Lütfen kontrol et.', false, '{}'::jsonb); end if;
    if v_partner is not null and v_partner <> v_owner then insert into public.notifications (id,user_id,type,title,body,read,metadata) values (gen_random_uuid(), v_partner, 'sale', 'Alıcı satışa itiraz etti', coalesce(v_title,'İlan') || ' için alıcı sorun bildirdi.', false, '{}'::jsonb); end if;
    return 'disputed';
  end if;
  return 'invalid';
end; $$;

-- Token'lı public onay: giriş yapılmadan (anon) da çağrılabilir.
grant execute on function public.sale_confirm_info(text) to anon, authenticated;
grant execute on function public.confirm_sale(text, text) to anon, authenticated;
