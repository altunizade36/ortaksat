-- ============================================================================
-- 2026-07-17 — Ortaklık denetimi: kalan bulgular (P2-8, P1-6, P2-9, P1-7)
-- Hepsi CANLIYA uygulandı + rollback-testli doğrulandı + E2E 55 PASS.
-- KANITLAR:
--   P2-8 başvuruda_kilit=25 → satıcı %3'e düşürüp onayladı → agreed 25 KALDI (yem-değiştir öldü)
--   P1-6 cancelled→rejoin=pending (şartlar tazelendi) | blocked→"Partnership blocked by seller"
--   P1-7 teslim_edilmiş_iş=kaydedildi(10000) | leadsiz_yeni_iş=reddedildi | blocked=reddedildi
-- ============================================================================

-- ============================================================================
-- Ortaklık denetimi — kalan bulgular (P2-8, P1-6, P1-7, P2-9), bizim mantığımıza göre.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- P2-8: Şartlar BAŞVURU anında kilitlensin (onay anında DEĞİL).
-- ÖNCE: snapshot yalnız status='active' olunca alınıyordu. `approval` VARSAYILAN mod →
--   ortak %25 görüp başvurur (pending, snapshot YOK), satıcı ilanı %3'e düşürüp onaylar →
--   agreed=%3. Ortak "kabul edildi" bildirimi alır, hiç razı olmadığı orana bağlanır (yem-değiştir).
-- BİZİM MANTIK: ortak GÖRDÜĞÜ şarta razı olur → kilit başvuruda (INSERT) atılır.
-- P1-6 (destek): partner_join ile YENİDEN AÇILIŞTA şartlar tazelensin — dönen ortak
--   o anki ilan şartlarını görüp katılıyor. Yalnız `app.trusted_join` bağlamında (yani
--   SADECE partner_join RPC'si) yeniden-snapshot serbest; satıcının ham UPDATE'i ASLA.
create or replace function public.trg_snapshot_partnership_terms()
returns trigger language plpgsql set search_path to 'public'
as $function$
begin
  -- Kilit: agreed_at boşsa (yeni başvuru veya partner_join ile yeniden açılış) ilandan çek.
  if new.agreed_at is null then
    select commission_type, commission_value, commission_tiers, attribution_window_days,
           return_window_days, commission_due_days
      into new.agreed_commission_type, new.agreed_commission_value, new.agreed_commission_tiers,
           new.agreed_attribution_window_days, new.agreed_return_window_days,
           new.agreed_commission_due_days
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
  end if;
  return new;
end; $function$;

-- ---------------------------------------------------------------------------
-- P1-6: Ayrılan ortak GERİ DÖNEBİLSİN + sahte başarı bitsin.
-- ÖNCE: yalnız 'rejected' yeniden açılıyordu; 'cancelled' (ortağın KENDİ ayrılışı) için
--   satır değişmeden dönüyordu — hata da yok. İstemci bunu BAŞARI sanıp ortaklık nesnesi
--   veriyordu; DB'de satır 'cancelled' kalıyor → referral_lead_allowed false + link kaydı
--   silinmiş → link bir daha ASLA atıf yapmaz. Ortak o ilana kalıcı kilitleniyordu, sıfır geri bildirim.
-- BİZİM MANTIK: gönüllü ayrılış (cancelled) ve tamamlanma (completed) geri dönülebilir;
--   'blocked' (satıcı engelledi) TERMİNAL → net hata. Yeniden açılışta şartlar TAZELENİR
--   (agreed_at=null → trigger o anki ilandan yeniden kilitler).
create or replace function public.partner_join(p_partnership_id uuid, p_listing_id uuid, p_ref_code text, p_invite_code text, p_note text, p_share_channel text, p_audience text, p_platform_handle text, p_reach integer)
returns TABLE(r_id uuid, r_status text)
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid; v_mode text; v_lstatus text; v_demo boolean; v_minrating numeric; v_prating numeric;
  v_target text; v_existing_id uuid; v_existing_status text;
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

  insert into public.partnerships (id, listing_id, partner_id, ref_code, status, note, share_channel, audience, platform_handle, reach_estimate, approved_at)
    values (p_partnership_id, p_listing_id, v_uid, p_ref_code, v_target::partnership_status,
      coalesce(p_note, ''), p_share_channel, p_audience, p_platform_handle, coalesce(p_reach, 0),
      case when v_target = 'active' then now() else null end);
  return query select p_partnership_id, v_target;
end $function$;

-- ---------------------------------------------------------------------------
-- P2-9: Lead spam throttle (referral_clicks'te vardı, leads'te YOKTU).
-- anon `leads` INSERT edebiliyor (referral_lead_allowed yalnız durum bakar) → ortak kendi
-- ortaklığına sınırsız sahte lead basıp huniyi şişirebilir; rakip satıcının kutusunu sahte
-- alıcı adı/telefonuyla doldurup her birinde notify_on_lead → bildirim+e-posta spam'i tetikler.
-- BİZİM MANTIK: tıklama throttle'ıyla aynı desen — sessizce düş (hata yok), gerçek huniyi boğma.
-- Ortaklık başına saatte 30 lead: gerçek dönüşüm için fazlasıyla bol, sel için kapalı.
create or replace function private.throttle_referral_leads()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.partnership_id is not null and (
    select count(*) from public.leads
    where partnership_id = new.partnership_id and created_at > now() - interval '1 hour'
  ) >= 30 then
    return null; -- satır eklenmez, hata da yok (tıklama throttle'ıyla aynı davranış)
  end if;
  return new;
end; $function$;

drop trigger if exists trg_throttle_referral_leads on public.leads;
create trigger trg_throttle_referral_leads
  before insert on public.leads
  for each row execute function private.throttle_referral_leads();

-- P1-7: Satıcı, ortaklığı sonlandırıp TESLİM EDİLMİŞ işi silemesin.
-- ÖNCE: record_sale koşulsuz `status='active'` istiyordu. Ortak lead getirir, alıcı platform
--   dışında satın alır; satıcı "Ortaklığı sonlandır" der → satış ARTIK HİÇ kaydedilemez
--   (RPC exception) → hak edilmiş komisyonun kaydı YOK; ortak kendi da kaydedemez.
--   Tek tıkla, masum görünen bir borç silme yolu.
-- BİZİM MANTIK: ortaklığı sonlandırmak YENİ işi durdurur, TESLİM EDİLMİŞ işi SİLMEZ.
--   Aktif → her zaman OK. cancelled/completed → yalnız o ortaklığa ait GEÇERLİ (dönüşmemiş)
--   bir LEAD varsa OK: lead'in VARLIĞI, iş teslim edildiğinde ortaklığın AKTİF olduğunu
--   KANITLAR (referral_lead_allowed lead oluşturmak için active şart koşar) → sonlanmış
--   ortaklık yeni iş kazanamaz ama geçmiş hakkı korunur. blocked (kötüye kullanım) → ASLA.
create or replace function public.record_sale(p_commission_id uuid, p_order_id uuid, p_listing_id uuid, p_partnership_id uuid, p_lead_id uuid, p_commission_amount numeric, p_sale_amount numeric, p_quantity integer, p_buyer_name text, p_delivery_status text, p_return_until date, p_status text, p_approved_at timestamp with time zone, p_payout_note text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_owner uuid; v_stock int; v_listing_status text; v_part_status text;
        v_part_listing uuid; v_lead_part uuid; v_lead_listing uuid;
        v_prior int; v_base numeric; v_bonus numeric; v_bonus_amt numeric; v_bonus_quota int; v_amount numeric;
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

revoke execute on function public.record_sale(uuid,uuid,uuid,uuid,uuid,numeric,numeric,integer,text,text,date,text,timestamptz,text) from public;
revoke execute on function public.record_sale(uuid,uuid,uuid,uuid,uuid,numeric,numeric,integer,text,text,date,text,timestamptz,text) from anon;
grant execute on function public.record_sale(uuid,uuid,uuid,uuid,uuid,numeric,numeric,integer,text,text,date,text,timestamptz,text) to authenticated;

