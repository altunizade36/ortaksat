-- ============================================================================
-- 2026-07-17 — Güvenlik sertleştirme + komisyon SUNUCU OTORİTESİ
-- Bu dosya, adversarial para-doğruluk + güvenlik denetimi sonrası CANLIYA
-- uygulanan DDL'i kayda geçirir (drift kapatma). DB migration'lardan yeniden
-- kurulursa bu düzeltmeler KAYBOLMASIN, kapatılan açıklar GERİ GELMESİN.
-- Hepsi rollback-testli + E2E (55/62/02/03/94) ile doğrulandı.
-- ============================================================================

-- 1) Reddedilen ilan sebebi (satıcıya gösterilir; edit'te yeniden taranır).
alter table public.listings add column if not exists rejection_reason text;

-- ---------------------------------------------------------------------------
-- 2) IBAN -> payout_info (satır-bazlı RLS; preferences sızıntısı kapatıldı)
-- ---------------------------------------------------------------------------
-- P1: IBAN `profiles.preferences` JSONB'de tutuluyordu; `preferences` kolonu `authenticated`
-- SELECT grant'ında + profiles SELECT RLS'i USING(true) → HERHANGİ girişli kullanıcı
-- `select preferences from profiles` ile TÜM IBAN'ları toplayabiliyordu (finansal veri).
-- Kolon-grant satır-farkında olmadığı için düz revoke own-read'i de kırar; doğru araç
-- SATIR-BAZLI RLS → IBAN kendi tablosuna taşınır. Canlıda 0 IBAN var → migrasyon gerekmez.
create table if not exists public.payout_info (
  user_id uuid primary key references auth.users(id) on delete cascade,
  iban text,
  updated_at timestamptz not null default now()
);

alter table public.payout_info enable row level security;

-- Yalnız sahibi okur/yazar. Admin dahil BAŞKASI okuyamaz (finansal veri; gerekirse
-- ileride denetimli SD fn ile açılır).
drop policy if exists "own payout info read" on public.payout_info;
create policy "own payout info read" on public.payout_info
  for select using (user_id = (select auth.uid()));

drop policy if exists "own payout info insert" on public.payout_info;
create policy "own payout info insert" on public.payout_info
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "own payout info update" on public.payout_info;
create policy "own payout info update" on public.payout_info
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update on public.payout_info to authenticated;
-- anon'a GRANT YOK (bilinçli).

-- ---------------------------------------------------------------------------
-- Engellenen kullanıcıları profil bilgisiyle getir (yönetim ekranı).
-- Yalnız çağıranın engellediklerini döndürür.
-- ---------------------------------------------------------------------------
create or replace function public.my_blocked_profiles()
returns table(id uuid, full_name text, avatar_url text, role text, blocked_at timestamptz)
language sql stable security definer set search_path to 'public' as $fn$
  select p.id, p.full_name, p.avatar_url, p.role, b.created_at
  from public.blocked_users b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$fn$;
grant execute on function public.my_blocked_profiles() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) P0: komisyon defteri sahteciliği (amount DONDUR + politika UPDATE-only)
-- ---------------------------------------------------------------------------
-- P0: komisyon defteri istemciden sahtelenebiliyordu (amount şişir / fabrikadan-oluştur / sil).
-- 1) guard_commission_paid: amount+sale_amount DONDUR (record_sale INSERT'i dışında değişemez) +
--    paid yalnız seller_paid/disputed'dan gelebilir.
create or replace function public.guard_commission_paid()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_partner uuid; v_role text;
begin
  -- Para değerleri record_sale INSERT'inde kilitlenir; SONRADAN HİÇBİR YOL değiştiremez.
  -- (RLS kolon kısıtlayamadığı için satıcı/ortak amount'u istemciden UPDATE edebiliyordu.)
  if tg_op = 'UPDATE' then
    if new.amount is distinct from old.amount or new.sale_amount is distinct from old.sale_amount then
      raise exception 'Komisyon tutarı değiştirilemez (kayıt anında kilitlenir).';
    end if;
  end if;
  if new.status = 'paid'
     and (tg_op = 'INSERT' or old.status is distinct from 'paid')
     and auth.uid() is not null then
    select p.partner_id into v_partner from public.partnerships p where p.id = new.partnership_id;
    select role into v_role from public.profiles where id = auth.uid();
    if auth.uid() <> coalesce(v_partner, '00000000-0000-0000-0000-000000000000'::uuid)
       and coalesce(v_role, 'user') not in ('admin', 'moderator', 'super_admin') then
      raise exception 'Komisyon ödeme onayı (paid) yalnız ortak tarafından yapılabilir.';
    end if;
    -- paid yalnız satıcı ödeme bildirdikten (seller_paid) veya itiraz çözümünden (disputed)
    -- gelebilir; partner approved→paid atlayıp ödenmemiş komisyonu "ödendi" gösteremez.
    if tg_op = 'UPDATE' and old.status not in ('seller_paid', 'disputed')
       and coalesce(v_role, 'user') not in ('admin', 'moderator', 'super_admin') then
      raise exception 'Ödeme onayı yalnız satıcı ödeme bildirdikten sonra yapılabilir.';
    end if;
  end if;
  return new;
end $function$;

-- 2) Satıcının FOR ALL politikasını UPDATE-only yap (INSERT/DELETE kaldır). record_sale
--    SECURITY DEFINER olduğu için RLS'yi aşarak ekler; istemci komisyon INSERT/DELETE etmiyor.
--    Böylece "fabrikadan-oluştur" ve "sil (borç sil)" yolları kapanır. Soft-delete (deleted_at)
--    zaten UPDATE olduğu için etkilenmez.
drop policy if exists "listing owner manages commissions" on public.commissions;
drop policy if exists "listing owner updates commissions" on public.commissions;
create policy "listing owner updates commissions" on public.commissions
  for update
  using (exists (select 1 from public.listings l where l.id = commissions.listing_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.listings l where l.id = commissions.listing_id and l.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 4) orders SD-kilit + messages gevşek politika + rol-yükseltme koşulsuz
-- ---------------------------------------------------------------------------
-- SAFE security batch (adversarial güvenlik denetimi bulguları).

-- P1: orders istemciden tamamen yazılabiliyordu (satıcı sahte sipariş/GMV enjekte eder).
-- record_sale (SECURITY DEFINER) siparişi sunucuda oluşturur; istemci orders'a HİÇ yazmıyor
-- (grep: 0 client insert/update). İstemci yazma politikalarını kaldır (SELECT kalır).
drop policy if exists "seller creates orders" on public.orders;
drop policy if exists "seller updates orders" on public.orders;

-- P2: messages "users send messages" politikası yalnız sender_id=auth.uid() kontrol edip
-- katılımcı-kontrollü "Message sender can create in conversation"ı OR'la geçersizleştiriyordu
-- → kullanıcı üyesi olmadığı bir konuşmaya mesaj enjekte edebiliyordu. Gevşek politikayı kaldır;
-- katılımcı-kontrollü politika + "blocked cannot send" (RESTRICTIVE) kalır. Meşru gönderim
-- konuşmayı önce oluşturur (gönderen katılımcıdır) → katılımcı kontrolünü geçer.
drop policy if exists "users send messages" on public.messages;

-- P2: rol-yükseltme koruması yalnız "aktif admin varsa" çalışıyordu (bootstrap/tüm-adminler-pasif
-- durumunda devre dışı). Koşulsuz yap — savunma veri durumuna bağlı olmasın.
create or replace function private.prevent_profile_role_escalation()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin()
     and (new.role is distinct from old.role or new.status is distinct from old.status)
  then
    raise exception 'Only admins can update profile role or status';
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5) İtibar sayaçları (successful_sales/follower_count) guard + trusted flag
-- ---------------------------------------------------------------------------
-- P2: successful_sales / follower_count trust guard'da YOKTU → kullanıcı
-- `update profiles set successful_sales=9999` ile sahte sosyal kanıt üretebiliyordu
-- (güven-tabanlı pazaryerinde alıcı kararını etkiler).
-- Sayaçlar SD trigger'larıyla güncellendiği için naif guard onları da bloklardı →
-- mevcut `app.trusted_rating_update` GUC desenini kullan (refresh_user_rating_on_reviews
-- ile aynı): bump fn'leri flag'i set eder, guard erken döner. PostgREST istemcileri bu
-- GUC'yi SET edemez → suistimal edilemez.

create or replace function public.bump_seller_successful_sales()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare seller uuid;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select owner_id into seller from listings where id = new.listing_id;
    if seller is not null then
      perform set_config('app.trusted_rating_update', 'on', true);
      update profiles set successful_sales = successful_sales + 1 where id = seller;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.bump_follower_count()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform set_config('app.trusted_rating_update', 'on', true);
    update profiles set follower_count = follower_count + 1 where id = new.seller_id;
  elsif tg_op = 'DELETE' then
    perform set_config('app.trusted_rating_update', 'on', true);
    update profiles set follower_count = greatest(0, follower_count - 1) where id = old.seller_id;
  end if;
  return null;
end;
$function$;

create or replace function private.prevent_profile_trust_escalation()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('app.trusted_rating_update', true), '') = 'on' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.verified_identity is distinct from old.verified_identity then
    raise exception 'Only admins can update identity verification';
  end if;
  if new.verified_instagram is distinct from old.verified_instagram then
    raise exception 'Only admins can update Instagram verification';
  end if;
  if new.rating is distinct from old.rating or new.response_rate is distinct from old.response_rate then
    raise exception 'Only system or admins can update profile trust metrics';
  end if;
  -- İtibar sayaçları YALNIZ sistem trigger'larıyla (trusted flag) değişir.
  if new.successful_sales is distinct from old.successful_sales
     or new.follower_count is distinct from old.follower_count then
    raise exception 'Only system can update reputation counters';
  end if;
  if new.phone is distinct from old.phone then
    new.verified_phone = false;
  elsif new.verified_phone is distinct from old.verified_phone then
    raise exception 'Phone verification cannot be edited directly';
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6) record_sale: komisyon SUNUCUDA hesaplanır (F1+F2+F3)
-- ---------------------------------------------------------------------------
-- F1/F2/F3: komisyon tutarının SUNUCU OTORİTESİ.
-- ÖNCE: record_sale istemciden gelen p_commission_amount'ı AYNEN saklıyordu. İstemci onu
--   `sales` bellek dizisinden türetiyordu; o dizi loadAccountSnapshot'ta commissions limit(500)
--   ile geliyor → satıcının >500 komisyonunda ortağın eski satışları pencereden düşüp
--   priorPartnerSales EKSİK sayılıyor → bonus YENİDEN veriliyor / tier yanlış (F1).
--   Ayrıca satıcı RPC'ye doğrudan EKSİK tutar geçip ortağı mağdur edebiliyordu (F2),
--   ve aynı tick'te iki satış aynı prior sayısını okuyup çift bonus verebiliyordu (F3).
-- SONRA: tutar sunucuda hesaplanır; p_commission_amount YOK SAYILIR (imza korunur →
--   istemci değişikliği gerekmez). prior sayısı otoriter COUNT; listing FOR UPDATE kilidi
--   aynı ortaklığın (ortaklık tek ilana ait) eşzamanlı satışlarını serileştirir → F3 de kapanır.
create or replace function public.record_sale(p_commission_id uuid, p_order_id uuid, p_listing_id uuid, p_partnership_id uuid, p_lead_id uuid, p_commission_amount numeric, p_sale_amount numeric, p_quantity integer, p_buyer_name text, p_delivery_status text, p_return_until date, p_status text, p_approved_at timestamp with time zone, p_payout_note text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_owner uuid; v_stock int; v_listing_status text; v_part_status text;
        v_prior int; v_base numeric; v_bonus numeric; v_bonus_amt numeric; v_bonus_quota int; v_amount numeric;
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
  if p_sale_amount is null or p_sale_amount < 0 then raise exception 'Invalid sale amount'; end if;
  select status::text into v_part_status from partnerships where id = p_partnership_id;
  if v_part_status is distinct from 'active' then raise exception 'Partnership not active'; end if;
  if p_lead_id is not null and exists (select 1 from leads where id = p_lead_id and status = 'converted') then
    raise exception 'Lead already converted';
  end if;

  -- --- KOMİSYON SUNUCUDA (OTORİTE) --- istemci semantiğiyle birebir:
  --   prior = bu ortaklığın iptal-olmayan (ve silinmemiş) komisyon sayısı
  --   base  = compute_agreed_commission (override > agreed snapshot + tier > canlı ilan)
  --   bonus = bonusAmount>0 && quota>0 && prior<quota ? round(bonusAmount) : 0
  select count(*) into v_prior from commissions
    where partnership_id = p_partnership_id
      and status <> 'cancelled'::commission_status
      and deleted_at is null;
  select coalesce(bonus_amount, 0), coalesce(bonus_quota, 0) into v_bonus_amt, v_bonus_quota
    from listings where id = p_listing_id;
  v_base := public.compute_agreed_commission(p_partnership_id, p_sale_amount, p_quantity, v_prior);
  v_bonus := case when v_bonus_amt > 0 and v_bonus_quota > 0 and v_prior < v_bonus_quota
                  then round(v_bonus_amt) else 0 end;
  v_amount := greatest(0, coalesce(v_base, 0) + v_bonus);

  insert into orders (id, listing_id, seller_id, partnership_id, amount, status)
    values (p_order_id, p_listing_id, v_owner, p_partnership_id, p_sale_amount, 'confirmed'::order_status);
  insert into commissions (id, order_id, listing_id, partnership_id, lead_id, amount, sale_amount,
    quantity, buyer_name, delivery_status, return_until, status, approved_at, payout_note)
    values (p_commission_id, p_order_id, p_listing_id, p_partnership_id, p_lead_id, v_amount,
    p_sale_amount, p_quantity, p_buyer_name, coalesce(p_delivery_status, 'confirmed')::order_status,
    p_return_until, p_status::commission_status, p_approved_at, p_payout_note);
  update listings set stock_count = stock_count - p_quantity,
    status = case when stock_count - p_quantity <= 0 then 'sold'::listing_status else status end
    where id = p_listing_id;
  if p_lead_id is not null then update leads set status = 'converted'::lead_status where id = p_lead_id; end if;
end $function$;

