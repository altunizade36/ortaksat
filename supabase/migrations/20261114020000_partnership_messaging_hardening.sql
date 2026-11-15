-- Ortaklık, anlaşma ve mesajlaşma: sunucu tarafı güçlendirme (2026-11-14 denetimi).
--
-- ORTAKLIK / ANLAŞMA
--  1. Bonus ve iade süresi artık anlaşmaya kilitlenir; satış kaydında oradan okunur (satıcı ilanı sonradan
--     değiştirince mevcut ortağın bonusu/iade süresi değişiyordu; iade süresini istemci gönderiyordu).
--  2. Satıcı ortaklık satırında her şeyi değiştirebiliyordu (ayrılan ortağı yeniden "aktif" yapmak, ortağı
--     değiştirmek). Durum geçişleri ve kimlik alanları artık sunucuda sınırlı.
--  3. Bekleyen başvuru geri çekilebilir; ortak başvururken komisyon önerebilir (ayrı sütun, nota gömülü değil).
--  4. Özel komisyon anlaşılan oranın altına yazılamaz; değişince ortağa bildirim gider.
--  5. Komisyon kaydının kime/neye ait olduğu (ortaklık, ilan, sipariş, adet, silinme) sonradan değiştirilemez:
--     satıcı borçlu komisyonu ortağın görünümünden çıkarabiliyordu.
--  6. Anlaşmazlık gerekçesi kalıcı saklanır (sonraki adımda eziliyordu) ve yöneticilere bildirilir.
-- MESAJLAŞMA
--  7. Askıya alınmış hesap sunucuda da mesaj atamaz / sohbet açamaz (yalnız istemcide engelliydi).
--  8. Sohbet yalnız ilanın satıcısıyla açılır; saatlik yeni sohbet sınırı; ek adresi yalnız kendi depomuz.
--  9. İlanın sohbeti, teklifi ya da şikâyeti varsa ilan silinmez, arşive alınır (yazışma kanıtı yok olmasın).
-- 10. Aynı sohbetten gelen okunmamış mesaj bildirimleri tek satırda toplanır; sohbet okununca kapanır.

-- ------------------------------------------------------------------ sütunlar
alter table public.partnerships
  add column if not exists agreed_bonus_amount numeric,
  add column if not exists agreed_bonus_quota integer,
  add column if not exists proposed_commission_value numeric,
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid;

alter table public.commissions
  add column if not exists dispute_reason text,
  add column if not exists dispute_opened_by uuid,
  add column if not exists dispute_opened_at timestamptz;

-- Mevcut ortaklıklar: bonus, bugünkü ilan değeriyle kilitlenir (kilit işlevi değişmeden ÖNCE yazılmalı).
update public.partnerships p
set agreed_bonus_amount = coalesce(l.bonus_amount, 0), agreed_bonus_quota = coalesce(l.bonus_quota, 0)
from public.listings l
where l.id = p.listing_id and p.agreed_at is not null and p.agreed_bonus_amount is null;

-- ------------------------------------------------------------------ 1) anlaşma kilidi (bonus dahil)
create or replace function public.trg_snapshot_partnership_terms()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Kilit: agreed_at boşsa (yeni başvuru veya partner_join ile yeniden açılış) ilandan çek.
  if new.agreed_at is null then
    select commission_type, commission_value, commission_tiers, attribution_window_days,
           return_window_days, commission_due_days, coalesce(bonus_amount, 0), coalesce(bonus_quota, 0)
      into new.agreed_commission_type, new.agreed_commission_value, new.agreed_commission_tiers,
           new.agreed_attribution_window_days, new.agreed_return_window_days,
           new.agreed_commission_due_days, new.agreed_bonus_amount, new.agreed_bonus_quota
      from public.listings where id = new.listing_id;
    new.agreed_at := now();
  end if;

  -- Kilitten sonra agreed_* DEĞİŞTİRİLEMEZ. Tek istisna: partner_join ile yeniden açılış
  -- (app.trusted_join) — PostgREST istemcisi bu GUC'yi set edemez → satıcı baypas edemez.
  if tg_op = 'UPDATE'
     and old.agreed_at is not null
     and coalesce(current_setting('app.trusted_join', true), '') <> '1' then
    new.agreed_at                       := old.agreed_at;
    new.agreed_commission_type          := old.agreed_commission_type;
    new.agreed_commission_value         := old.agreed_commission_value;
    new.agreed_commission_tiers         := old.agreed_commission_tiers;
    new.agreed_attribution_window_days  := old.agreed_attribution_window_days;
    new.agreed_return_window_days       := old.agreed_return_window_days;
    new.agreed_commission_due_days      := old.agreed_commission_due_days;
    new.agreed_bonus_amount             := old.agreed_bonus_amount;
    new.agreed_bonus_quota              := old.agreed_bonus_quota;
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.record_sale(p_commission_id uuid, p_order_id uuid, p_listing_id uuid, p_partnership_id uuid, p_lead_id uuid, p_commission_amount numeric, p_sale_amount numeric, p_quantity integer, p_buyer_name text, p_delivery_status text, p_return_until date, p_status text, p_approved_at timestamp with time zone, p_payout_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_owner uuid; v_stock int; v_listing_status text; v_part_status text;
        v_part_listing uuid; v_lead_part uuid; v_lead_listing uuid;
        v_prior int; v_base numeric; v_bonus numeric; v_bonus_amt numeric; v_bonus_quota int; v_amount numeric;
        v_return_days int;
begin
  -- KİMLİK ZORUNLU: anon/servis JWT'sinde sub yok → auth.uid() NULL. Eskiden bu durumda
  -- sahiplik kontrolü atlanıyordu (P0-3). Artık kimliksiz çağrı kesin reddedilir.
  if v_uid is null then raise exception 'Authentication required'; end if;

  if p_status not in ('return_pending', 'approved') then
    raise exception 'Invalid initial commission status'; -- 'paid' vb. ile doğrudan oluşturma yasak
  end if;
  select owner_id, stock_count, status::text into v_owner, v_stock, v_listing_status
    from listings where id = p_listing_id for update;
  if v_owner is null then raise exception 'Listing not found'; end if;
  if v_uid <> v_owner then raise exception 'Only the listing owner can record a sale'; end if;
  if v_listing_status <> 'active' then raise exception 'Listing not active'; end if;
  if p_quantity < 1 then raise exception 'Quantity must be >= 1'; end if;
  if v_stock < p_quantity then raise exception 'Insufficient stock'; end if;
  if p_sale_amount is null or p_sale_amount < 0 then raise exception 'Invalid sale amount'; end if;

  -- ORTAKLIK bu İLANA ait olmalı (çapraz-ilan komisyonu engellenir).
  select status::text, listing_id into v_part_status, v_part_listing
    from partnerships where id = p_partnership_id;
  if v_part_status is null then raise exception 'Partnership not found'; end if;
  if v_part_listing is distinct from p_listing_id then
    raise exception 'Partnership does not belong to this listing';
  end if;

  -- Ortaklık durumu (P1-7): aktif değilse yalnız TESLİM EDİLMİŞ iş (geçerli lead) kaydedilir.
  if v_part_status = 'blocked' then
    raise exception 'Partnership blocked';
  end if;
  if v_part_status <> 'active' then
    if v_part_status not in ('cancelled', 'completed') or p_lead_id is null then
      raise exception 'Partnership not active';
    end if;
  end if;

  -- LEAD bu ortaklığa VE bu ilana ait olmalı (atıf aklama engellenir).
  if p_lead_id is not null then
    select partnership_id, listing_id into v_lead_part, v_lead_listing from leads where id = p_lead_id;
    if v_lead_part is null then raise exception 'Lead not found'; end if;
    if v_lead_part is distinct from p_partnership_id then
      raise exception 'Lead belongs to a different partnership';
    end if;
    if v_lead_listing is distinct from p_listing_id then
      raise exception 'Lead belongs to a different listing';
    end if;
    if exists (select 1 from leads where id = p_lead_id and status = 'converted') then
      raise exception 'Lead already converted';
    end if;
  end if;

  -- --- KOMİSYON SUNUCUDA (OTORİTE) --- istemci p_commission_amount YOK SAYILIR.
  select count(*) into v_prior from commissions
    where partnership_id = p_partnership_id
      and status <> 'cancelled'::commission_status
      and deleted_at is null;
  -- Bonus ve iade süresi ANLAŞMADAN okunur (ortaklık kurulurken kilitlenen değerler); satıcı ilanı sonradan
  -- değiştirse de mevcut ortağın şartları değişmez. Eski kayıtlarda kilit yoksa ilandaki güncel değer kullanılır.
  select coalesce(p.agreed_bonus_amount, l.bonus_amount, 0), coalesce(p.agreed_bonus_quota, l.bonus_quota, 0),
         greatest(0, coalesce(p.agreed_return_window_days, l.return_window_days, 0))
    into v_bonus_amt, v_bonus_quota, v_return_days
    from partnerships p join listings l on l.id = p.listing_id where p.id = p_partnership_id;
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
    -- İade süresi ve ilk durum SUNUCUDA, anlaşılan iade penceresinden hesaplanır (istemci değeri yok sayılır).
    case when v_return_days > 0 then now() + make_interval(days => v_return_days) else null end,
    (case when v_return_days > 0 then 'return_pending' else 'approved' end)::commission_status,
    case when v_return_days > 0 then null else now() end, p_payout_note);
  update listings set stock_count = stock_count - p_quantity,
    status = case when stock_count - p_quantity <= 0 then 'sold'::listing_status else status end
    where id = p_listing_id;
  if p_lead_id is not null then update leads set status = 'converted'::lead_status where id = p_lead_id; end if;
end $function$;

-- ------------------------------------------------------------------ 2) durum geçişleri ve kimlik alanları
create or replace function private.guard_partnership_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_owner uuid;
begin
  -- Bitiş damgası (kim, ne zaman) her yolda sunucuda yazılır.
  if new.status is distinct from old.status then
    if new.status in ('cancelled', 'blocked', 'rejected', 'completed') then
      new.ended_at := now(); new.ended_by := v_uid;
    else
      new.ended_at := null; new.ended_by := null;
    end if;
  else
    new.ended_at := old.ended_at; new.ended_by := old.ended_by;
  end if;

  -- Servis/zamanlayıcı, doğrulanmış katılım işlevi ve personel serbesttir.
  if v_uid is null or coalesce(current_setting('app.trusted_join', true), '') = '1' or public.is_admin() then
    return new;
  end if;

  if new.partner_id is distinct from old.partner_id or new.listing_id is distinct from old.listing_id
     or new.ref_code is distinct from old.ref_code or new.created_at is distinct from old.created_at
     or new.proposed_commission_value is distinct from old.proposed_commission_value then
    raise exception 'Ortaklığın tarafları ve başvuru bilgileri değiştirilemez.' using errcode = '42501';
  end if;

  select owner_id into v_owner from public.listings where id = old.listing_id;
  if v_uid = v_owner then
    if new.status is distinct from old.status and not (
         (old.status = 'pending' and new.status in ('active', 'rejected', 'blocked'))
      or (old.status = 'active'  and new.status in ('cancelled', 'blocked'))
      or (old.status = 'blocked' and new.status = 'cancelled')
    ) then
      raise exception 'Bu ortaklık durumu değişikliği yapılamaz.' using errcode = '42501';
    end if;
  elsif v_uid = old.partner_id then
    if new.status is distinct from old.status and not (old.status in ('active', 'pending') and new.status = 'cancelled') then
      raise exception 'Bu ortaklık durumu değişikliği yapılamaz.' using errcode = '42501';
    end if;
    if new.commission_override_type is distinct from old.commission_override_type
       or new.commission_override_value is distinct from old.commission_override_value
       or new.approved_at is distinct from old.approved_at
       or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Bu alanları yalnız satıcı değiştirebilir.' using errcode = '42501';
    end if;
  else
    raise exception 'Bu ortaklığı değiştirme yetkin yok.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists a_guard_partnership_update on public.partnerships;
create trigger a_guard_partnership_update
  before update on public.partnerships
  for each row execute function private.guard_partnership_update();

-- ------------------------------------------------------------------ 3) başvuruyu geri çekme + komisyon önerisi
create or replace function public.leave_partnership(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
begin
  if v_uid is null then
    return 'unauthorized';
  end if;
  select status::text into v_old from public.partnerships where id = p_id and partner_id = v_uid;
  if v_old is null or v_old not in ('active', 'pending') then
    return 'noop';
  end if;
  update public.partnerships set status = 'cancelled' where id = p_id and partner_id = v_uid;
  return case when v_old = 'pending' then 'withdrawn' else 'left' end;
end;
$$;

drop function if exists public.partner_join(p_partnership_id uuid, p_listing_id uuid, p_ref_code text, p_invite_code text, p_note text, p_share_channel text, p_audience text, p_platform_handle text, p_reach integer);
CREATE OR REPLACE FUNCTION public.partner_join(p_partnership_id uuid, p_listing_id uuid, p_ref_code text, p_invite_code text, p_note text, p_share_channel text, p_audience text, p_platform_handle text, p_reach integer, p_proposed_value numeric DEFAULT NULL::numeric)
 RETURNS TABLE(r_id uuid, r_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid; v_mode text; v_lstatus text; v_demo boolean; v_minrating numeric; v_prating numeric;
  v_target text; v_existing_id uuid; v_existing_status text; v_prop numeric;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select l.owner_id, l.partnership_mode::text, l.status::text, coalesce(l.demo, false), coalesce(l.min_partner_rating, 0)
    into v_owner, v_mode, v_lstatus, v_demo, v_minrating
    from public.listings l where l.id = p_listing_id;
  if v_owner is null then raise exception 'Listing not found'; end if;
  if v_demo then raise exception 'Demo listing'; end if;
  if v_lstatus <> 'active' then raise exception 'Listing not active'; end if;
  if v_owner = v_uid then raise exception 'Cannot join own listing'; end if;
  select coalesce(rating, 0) into v_prating from public.profiles where id = v_uid;
  if v_prating > 0 and v_prating < v_minrating then raise exception 'Insufficient partner rating'; end if;

  if v_mode = 'open' then
    v_target := 'active';
  elsif v_mode = 'invite' then
    if p_invite_code is not distinct from public.listing_invite_code(p_listing_id, v_owner) then
      v_target := 'active';
    else
      raise exception 'Invalid invite code';
    end if;
  else
    v_target := 'pending';
  end if;

  -- Ortağın önerdiği komisyon: yalnız onay bekleyen başvuruda anlamlıdır; geçersiz değer yok sayılır.
  v_prop := case when v_target = 'pending' and p_proposed_value is not null and p_proposed_value > 0 and p_proposed_value < 10000000
                 then round(p_proposed_value, 2) else null end;

  perform set_config('app.trusted_join', '1', true);

  select p.id, p.status::text into v_existing_id, v_existing_status
    from public.partnerships p where p.listing_id = p_listing_id and p.partner_id = v_uid;

  if v_existing_id is not null then
    -- Satıcı engellediyse: terminal, NET hata (istemci sessizce "başarı" sanmasın).
    if v_existing_status = 'blocked' then
      raise exception 'Partnership blocked by seller';
    end if;
    -- Zaten içerideyse (active/pending): olduğu gibi dön (no-op).
    if v_existing_status not in ('rejected', 'cancelled', 'completed') then
      return query select v_existing_id, v_existing_status;
      return;
    end if;
    -- rejected / cancelled / completed → YENİDEN AÇ; şartları o anki ilandan TAZELE.
    update public.partnerships set
      status = v_target::partnership_status,
      rejection_reason = null,
      proposed_commission_value = v_prop,
      commission_override_type = null,
      commission_override_value = null,
      agreed_at = null,               -- trigger (trusted_join) güncel şartlarla yeniden kilitler
      note = coalesce(nullif(p_note, ''), note),
      share_channel = coalesce(nullif(p_share_channel, ''), share_channel),
      audience = coalesce(nullif(p_audience, ''), audience),
      platform_handle = coalesce(nullif(p_platform_handle, ''), platform_handle),
      reach_estimate = coalesce(p_reach, reach_estimate),
      approved_at = case when v_target = 'active' then now() else approved_at end
      where public.partnerships.id = v_existing_id;
    return query select v_existing_id, v_target;
    return;
  end if;

  insert into public.partnerships (id, listing_id, partner_id, ref_code, status, note, share_channel, audience, platform_handle, reach_estimate, approved_at, proposed_commission_value)
    values (p_partnership_id, p_listing_id, v_uid, p_ref_code, v_target::partnership_status,
      coalesce(p_note, ''), p_share_channel, p_audience, p_platform_handle, coalesce(p_reach, 0),
      case when v_target = 'active' then now() else null end, v_prop);
  return query select p_partnership_id, v_target;
end $function$;
grant execute on function public.partner_join(uuid, uuid, text, text, text, text, text, text, integer, numeric) to authenticated;
revoke execute on function public.partner_join(uuid, uuid, text, text, text, text, text, text, integer, numeric) from public, anon;

-- Satıcı başvuruyu onaylar: ilan oranıyla ya da ortağın önerdiği oranla. Önerilen oran ilan oranından
-- yüksekse "ortağa özel oran" olarak yazılır (sunucu zaten ikisinden yüksek olanı uygular); düşükse
-- ilan oranı geçerli kalır (ortak, ilandakinden azını isteyemez — anlaşma tabanı ilandır).
create or replace function public.approve_partnership(p_id uuid, p_accept_proposal boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); r record;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select p.id, p.status::text as status, p.proposed_commission_value as prop, p.agreed_commission_type as atype,
         p.agreed_commission_value as avalue, l.owner_id
    into r
    from public.partnerships p join public.listings l on l.id = p.listing_id
    where p.id = p_id for update of p;
  if r.id is null then raise exception 'Partnership not found'; end if;
  if r.owner_id <> v_uid and not public.is_admin() then raise exception 'Only the listing owner can approve' using errcode = '42501'; end if;
  if r.status <> 'pending' then return 'noop'; end if;

  if p_accept_proposal and r.prop is not null and r.atype in ('rate', 'fixed')
     and r.prop > coalesce(r.avalue, 0) and (r.atype <> 'rate' or r.prop <= 90) then
    update public.partnerships
       set status = 'active', approved_at = now(), rejection_reason = null,
           commission_override_type = r.atype, commission_override_value = r.prop
     where id = p_id;
    return 'approved_with_proposal';
  end if;
  update public.partnerships set status = 'active', approved_at = now(), rejection_reason = null where id = p_id;
  return 'approved';
end;
$$;
revoke execute on function public.approve_partnership(uuid, boolean) from public, anon;
grant execute on function public.approve_partnership(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------ 4) özel komisyon: taban + bildirim
create or replace function private.validate_mobile_partner_override()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
 if new.commission_override_type is null and new.commission_override_value is null then return new; end if;
 if new.commission_override_type is null or new.commission_override_type not in ('rate','fixed')
  or new.commission_override_value is null or new.commission_override_value::text in ('NaN','Infinity','-Infinity')
  or new.commission_override_value<=0 or (new.commission_override_type='rate' and new.commission_override_value>90)
 then raise exception 'Geçerli bir özel komisyon gir. Yüzde 0 ile 90 arasında olmalıdır.' using errcode='22023'; end if;
 -- Özel komisyon anlaşılan oranın ALTINA yazılamaz (aynı türdeyse). Sunucu satışta zaten yüksek olanı uygular;
 -- düşük değer yalnız iki tarafa yanlış tutar gösterir.
 if new.agreed_commission_type is not null and new.commission_override_type = new.agreed_commission_type
    and new.commission_override_value < coalesce(new.agreed_commission_value, 0) then
   raise exception 'Özel komisyon, anlaşılan komisyonun altında olamaz.' using errcode='22023';
 end if;
 return new;
end $$;

create or replace function private.notify_partner_override_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_title text; v_label text;
begin
  if new.commission_override_type is not distinct from old.commission_override_type
     and new.commission_override_value is not distinct from old.commission_override_value then
    return new;
  end if;
  if new.status not in ('active', 'pending') then return new; end if;
  begin
    select title into v_title from public.listings where id = new.listing_id;
    if new.commission_override_value is null then
      insert into public.notifications (user_id, type, title, body, metadata)
      values (new.partner_id, 'application', 'Özel komisyonun kaldırıldı',
              format('"%s" için sana özel komisyon kaldırıldı; anlaşmadaki komisyon geçerli.', left(coalesce(v_title, 'İlan'), 60)),
              jsonb_build_object('listingId', new.listing_id, 'partnershipId', new.id, 'kind', 'commission_override'));
    else
      v_label := case when new.commission_override_type = 'rate' then '%' || trim(to_char(new.commission_override_value, 'FM999990.##'))
                      else trim(to_char(new.commission_override_value, 'FM999G999G990')) || ' TL' end;
      insert into public.notifications (user_id, type, title, body, metadata)
      values (new.partner_id, 'application', 'Sana özel komisyon tanımlandı',
              format('"%s" için sana özel komisyon: %s.', left(coalesce(v_title, 'İlan'), 60), v_label),
              jsonb_build_object('listingId', new.listing_id, 'partnershipId', new.id, 'kind', 'commission_override'));
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists notify_partner_override_change on public.partnerships;
create trigger notify_partner_override_change
  after update of commission_override_type, commission_override_value on public.partnerships
  for each row execute function private.notify_partner_override_change();

-- ------------------------------------------------------------------ 5) komisyon kaydının kimliği + 6) anlaşmazlık
create or replace function private.guard_commission_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_staff boolean := false;
begin
  if v_uid is not null then v_staff := public.is_admin(); end if;

  -- Kaydın kime ve neye ait olduğu sonradan değiştirilemez (servis ve personel dışında).
  if v_uid is not null and not v_staff and (
       new.partnership_id is distinct from old.partnership_id or new.listing_id is distinct from old.listing_id
    or new.order_id is distinct from old.order_id or new.lead_id is distinct from old.lead_id
    or new.quantity is distinct from old.quantity or new.deleted_at is distinct from old.deleted_at
    or new.created_at is distinct from old.created_at) then
    raise exception 'Komisyon kaydının ait olduğu ortaklık, ilan ve sipariş değiştirilemez.' using errcode = '42501';
  end if;

  -- Anlaşmazlık: gerekçe, açan ve tarih açıldığı anda kilitlenir (sonraki adımda not alanı değişse de kalır).
  if new.status = 'disputed' and old.status is distinct from 'disputed' then
    new.dispute_reason := nullif(btrim(coalesce(new.payout_note, '')), '');
    new.dispute_opened_by := v_uid;
    new.dispute_opened_at := now();
  elsif v_uid is not null and not v_staff then
    new.dispute_reason := old.dispute_reason;
    new.dispute_opened_by := old.dispute_opened_by;
    new.dispute_opened_at := old.dispute_opened_at;
  end if;
  return new;
end;
$$;

drop trigger if exists a_guard_commission_identity on public.commissions;
create trigger a_guard_commission_identity
  before update on public.commissions
  for each row execute function private.guard_commission_identity();

create or replace function private.notify_admins_commission_dispute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'disputed' and old.status is distinct from 'disputed' then
    begin
      insert into public.notifications (user_id, type, title, body, metadata)
      select p.id, 'system', 'Komisyon anlaşmazlığı açıldı',
             'Bir satış kaydında taraflardan biri anlaşmazlık bildirdi. Yönetim panelinden inceleyebilirsin.',
             jsonb_build_object('commissionId', new.id, 'listingId', new.listing_id, 'kind', 'commission_dispute')
      from public.profiles p
      where p.role in ('admin', 'super_admin', 'moderator') and p.status = 'active';
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_admins_commission_dispute on public.commissions;
create trigger notify_admins_commission_dispute
  after update of status on public.commissions
  for each row execute function private.notify_admins_commission_dispute();

-- ------------------------------------------------------------------ 7-8) mesajlaşma korumaları
create or replace function private.guard_messaging_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_recent int;
begin
  if v_uid is null or public.is_admin() then return new; end if;

  -- Askıya alınmış / silinmiş hesap mesaj atamaz, sohbet açamaz.
  if exists (select 1 from public.profiles where id = v_uid and status::text in ('suspended', 'deleted')) then
    raise exception 'Hesabın askıda olduğu için mesaj gönderemezsin.' using errcode = '42501';
  end if;

  if tg_table_name = 'conversations' then
    -- Sohbet yalnız ilanın satıcısıyla açılır (satıcı iki taraftan biri olmalı).
    if not (new.seller_id = any (new.participant_ids)) then
      raise exception 'seller must be a participant' using errcode = '42501';
    end if;
    -- Yeni kişilere toplu mesaj atılmasın: başkasının ilanında saatte en çok 40 yeni sohbet.
    if new.seller_id <> v_uid then
      select count(*) into v_recent from public.conversations c
      where v_uid = any (c.participant_ids) and c.seller_id <> v_uid and c.created_at > now() - interval '1 hour';
      if v_recent >= 40 then
        raise exception 'Çok kısa sürede çok fazla yeni sohbet başlattın. Biraz sonra tekrar dene.' using errcode = 'P0001';
      end if;
    end if;
  else
    -- Ek yalnız kendi depomuzdaki herkese açık dosya olabilir (dış bağlantı ek olarak gönderilemez).
    if new.attachment_url is not null and new.attachment_url !~ '^https://akyzzdwbzgsnhdircuce\.supabase\.co/storage/v1/object/public/[a-z-]+/' then
      raise exception 'Geçersiz ek adresi.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists a_guard_messaging_sender on public.messages;
create trigger a_guard_messaging_sender before insert on public.messages
  for each row execute function private.guard_messaging_sender();
drop trigger if exists a_guard_messaging_sender on public.conversations;
create trigger a_guard_messaging_sender before insert on public.conversations
  for each row execute function private.guard_messaging_sender();

-- ------------------------------------------------------------------ 9) ilan kaldırma
CREATE OR REPLACE FUNCTION public.remove_listing(p_listing_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid; v_title text; v_has_history boolean; r record;
begin
  select owner_id, title into v_owner, v_title from public.listings where id = p_listing_id;
  if v_owner is null then return 'not_found'; end if;

  -- Yetki: yalnız ilan sahibi ya da admin/moderatör.
  if auth.uid() is distinct from v_owner and not is_admin() then
    raise exception 'Bu ilani kaldirma yetkin yok.';
  end if;

  select exists(select 1 from public.commissions   where listing_id = p_listing_id)
      or exists(select 1 from public.orders        where listing_id = p_listing_id)
      or exists(select 1 from public.partnerships  where listing_id = p_listing_id)
      or exists(select 1 from public.leads         where listing_id = p_listing_id)
      -- Sohbet, teklif ve şikâyet kayıtları ilana ON DELETE CASCADE bağlıdır: ilan gerçekten silinirse
      -- yazışma ve şikâyet kanıtı da yok olur. Bunlardan biri varsa ilan silinmez, arşive alınır.
      or exists(select 1 from public.conversations where listing_id = p_listing_id)
      or exists(select 1 from public.offers        where listing_id = p_listing_id)
      or exists(select 1 from public.reports       where listing_id = p_listing_id)
    into v_has_history;

  if not v_has_history then
    delete from public.listings where id = p_listing_id;   -- temiz ilan → gerçekten sil
    return 'deleted';
  end if;

  -- Geçmişi olan ilan: gizle ama SATIRI + para/geçmiş kayıtlarını KORU.
  update public.listings set status = 'archived' where id = p_listing_id;

  -- Aktif ortaklıkları sonlandır + ortağı bilgilendir (ölü referans linki bırakma).
  -- (referral_public_links zaten listing/partnership trigger'larıyla otomatik siliniyor.)
  for r in select id, partner_id from public.partnerships
           where listing_id = p_listing_id and status = 'active' loop
    update public.partnerships set status = 'cancelled' where id = r.id;
    insert into public.notifications (id, user_id, type, title, body, read, metadata)
    values (gen_random_uuid(), r.partner_id, 'system', 'İlan kaldırıldı',
            coalesce(v_title, 'İlan') || ' satıcı tarafından kaldırıldı. Ortaklığın sonlandırıldı; hak edilmiş komisyonların korunur.',
            false, '{}'::jsonb);
  end loop;

  return 'archived';
end; $function$;

-- ------------------------------------------------------------------ 10) mesaj bildirimleri
-- Aynı sohbetin okunmamış önceki bildirimi kapatılır, yenisi "N yeni mesaj" sayısını taşır. Eski satırlar
-- silinmez (e-posta/telefon bildirimi sıklık sınırları son bildirimlerin varlığına bakar).
create or replace function private.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text; v_preview text; v_count int := 1; v_prev int;
begin
  if new.receiver_id is null or new.receiver_id = new.sender_id then return new; end if;
  select nullif(btrim(full_name), '') into v_name from public.profiles where id = new.sender_id;
  v_preview := case when btrim(coalesce(new.body, '')) <> '' then left(new.body, 140)
                    when new.attachment_type = 'file' then '📎 ' || coalesce(new.attachment_name, 'Dosya')
                    else '📷 Görsel' end;
  begin
    select coalesce(sum(coalesce(nullif(metadata ->> 'count', '')::int, 1)), 0) into v_prev
      from public.notifications
      where user_id = new.receiver_id and type = 'message' and read = false
        and metadata ->> 'conversationId' = new.conversation_id::text;
    if v_prev > 0 then
      v_count := v_prev + 1;
      update public.notifications set read = true
        where user_id = new.receiver_id and type = 'message' and read = false
          and metadata ->> 'conversationId' = new.conversation_id::text;
    end if;
    insert into public.notifications (user_id, type, title, body, metadata)
    values (new.receiver_id, 'message',
            case when v_count > 1 then v_count || ' yeni mesaj' else 'Yeni mesaj' end,
            coalesce(v_name, 'Bir kullanıcı') || ': ' || v_preview,
            jsonb_build_object('conversationId', new.conversation_id, 'listingId', new.listing_id, 'count', v_count));
  exception when others then
    null; -- bildirim yazılamasa da mesaj kaydı korunur
  end;
  return new;
end;
$$;

-- Sohbet okununca o sohbetin mesaj bildirimi de okunmuş olur (rozet çift saymasın).
create or replace function private.read_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.read and not coalesce(old.read, false) and new.receiver_id is not null then
    update public.notifications set read = true
      where user_id = new.receiver_id and type = 'message' and read = false
        and metadata ->> 'conversationId' = new.conversation_id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists read_message_notifications on public.messages;
create trigger read_message_notifications
  after update of read on public.messages
  for each row execute function private.read_message_notifications();

notify pgrst, 'reload schema';
