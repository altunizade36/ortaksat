-- ============================================================================
-- 2026-07-17 — ORTAKLIK yaşam döngüsü P0 düzeltmeleri (adversarial denetim)
-- Hepsi CANLIYA uygulandı + rollback-testli doğrulandı + E2E 55 (para akışı) PASS.
-- ============================================================================

-- P0-1 (KRİTİK): "anlaşılan şartlar kilidi" HİÇ ÇALIŞMIYORDU.
-- Migration 20260712153046_audit_immutable_terms.sql korumalı fonksiyonu (public.
-- trg_snapshot_partnership_terms) YAZMIŞ ama partnerships trigger'ını ona hiç yeniden
-- YÖNLENDİRMEMİŞ → trigger eski, korumasız `snapshot_partnership_terms()`'i çağırmaya
-- devam ediyordu. İsim çakışması (trigger adı = yeni fonksiyon adı) bunu gizlemiş.
-- SONUÇ: satıcı, ortak katıldıktan sonra `PATCH /partnerships?id=eq.X {agreed_commission_value:1}`
-- ile anlaşılan oranı SESSİZCE kesebiliyordu (RLS "listing owners update partnerships" izin veriyor,
-- audit_partnership_change yalnız status değişimini loglar) → record_sale/compute_agreed_commission
-- kesilmiş oranı kullanırdı. Ortağın kilitli şartı kâğıt üstünde kalıyordu.
-- Korumalı fonksiyon: kilitten sonra (agreed_at dolu) TÜM agreed_* alanlarını OLD'dan geri yazar.
drop trigger if exists trg_snapshot_partnership_terms on public.partnerships;
create trigger trg_snapshot_partnership_terms
  before insert or update on public.partnerships
  for each row execute function public.trg_snapshot_partnership_terms();


-- P0-3 (KRİTİK): record_sale anon'a AÇIKTI ve sahiplik kontrolü `auth.uid() is not null`
--   koşuluna sarılıydı. Supabase ANON JWT'sinde `sub` claim'i YOKTUR → auth.uid() = NULL →
--   kontrol ATLANIYOR. Anon anahtar JS bundle'ında herkese açık olduğundan, HERKES
--   /rest/v1/rpc/record_sale çağırıp: sahte sipariş+komisyon (satıcıya uydurma borç),
--   stok düşümü ve stok bitince ilanı 'sold' yapıp BAŞKASININ ilanını sabote edebiliyordu.
--   record_payout bunu doğru yapıyor: `if v_uid is null then raise`. Aynı deseni uygula.
-- P0-4: record_sale, lead'in ORTAKLIĞA ve ortaklığın İLANA ait olduğunu doğrulamıyordu →
--   (A) atıf aklama: A'nın lead'i B ortaklığıyla kaydedilip komisyon B'ye yazılabiliyor, lead
--   'converted' olduğu için A bir daha asla kredilenemiyor; (B) çapraz-ilan komisyonu.
create or replace function public.record_sale(p_commission_id uuid, p_order_id uuid, p_listing_id uuid, p_partnership_id uuid, p_lead_id uuid, p_commission_amount numeric, p_sale_amount numeric, p_quantity integer, p_buyer_name text, p_delivery_status text, p_return_until date, p_status text, p_approved_at timestamp with time zone, p_payout_note text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_owner uuid; v_stock int; v_listing_status text; v_part_status text;
        v_part_listing uuid; v_lead_part uuid; v_lead_listing uuid;
        v_prior int; v_base numeric; v_bonus numeric; v_bonus_amt numeric; v_bonus_quota int; v_amount numeric;
begin
  -- KİMLİK ZORUNLU: anon/servis JWT'sinde sub yok → auth.uid() NULL. Eskiden bu durumda
  -- sahiplik kontrolü atlanıyordu (P0). Artık kimliksiz çağrı kesin reddedilir.
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
  if v_part_status is distinct from 'active' then raise exception 'Partnership not active'; end if;
  if v_part_listing is distinct from p_listing_id then
    raise exception 'Partnership does not belong to this listing';
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

-- Savunma derinliği: anon'un bu RPC'yi çağırma yetkisi HİÇ olmamalı (satışı yalnız girişli
-- ilan sahibi kaydeder). Fonksiyon içi kontrol zaten var; grant'ı da kapat.
revoke execute on function public.record_sale(uuid,uuid,uuid,uuid,uuid,numeric,numeric,integer,text,text,date,text,timestamptz,text) from anon;

-- Postgres, fonksiyonlara varsayılan EXECUTE'u PUBLIC'e verir; anon oradan MİRAS alır →
-- yalnız "revoke from anon" işe yaramaz. Önce PUBLIC'ten al, sonra yalnız authenticated'a ver.
-- (Asıl koruma fonksiyon içindeki `if v_uid is null then raise` — bu savunma derinliği.)
revoke execute on function public.record_sale(uuid,uuid,uuid,uuid,uuid,numeric,numeric,integer,text,text,date,text,timestamptz,text) from public;
revoke execute on function public.record_sale(uuid,uuid,uuid,uuid,uuid,numeric,numeric,integer,text,text,date,text,timestamptz,text) from anon;
grant execute on function public.record_sale(uuid,uuid,uuid,uuid,uuid,numeric,numeric,integer,text,text,date,text,timestamptz,text) to authenticated;


-- F5: Atıf penceresi ANLAŞILAN şarttan gelmeli (canlı ilandan değil).
-- SORUN: alıcı-tarafı saveRefAttribution() ilanın ANLIK attributionWindowDays'ini kullanıyordu.
-- Satıcı, ortak katıldıktan SONRA pencereyi kısaltırsa (ör. 30g → 1g) ortağın yavaş dönüşen
-- alıcıları atıfsız kalıyor → ortak anlaştığı krediyi KAYBEDİYOR. Oysa partnerships.
-- agreed_attribution_window_days snapshot'ı tam da bunu kilitlemek için var (join anında yazılır).
-- ÇÖZÜM: ref-link çözümleme tablosu anlaşılan pencereyi taşısın; istemci onu kullansın.
-- NOT: referral_public_links bir VIEW değil TABLO; anon/authenticated'da TABLO-seviyesi SELECT
-- grant'ı var → yeni kolon otomatik görünür (anon kolon-grant tuzağı burada geçerli değil).

alter table public.referral_public_links
  add column if not exists agreed_attribution_window_days int;

-- Doldurucu: anlaşılan snapshot > canlı ilan > 30 (varsayılan).
create or replace function private.refresh_referral_public_link(target_partnership_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if target_partnership_id is null then
    return;
  end if;

  delete from public.referral_public_links
  where partnership_id = target_partnership_id
    and not exists (
      select 1
      from public.partnerships p
      join public.listings l on l.id = p.listing_id
      where p.id = target_partnership_id
        and p.status = 'active'
        and l.status = 'active'
    );

  insert into public.referral_public_links (
    ref_code, partnership_id, listing_id, slug, title, price,
    commission_type, commission_value, category, location, image_url,
    agreed_attribution_window_days, updated_at
  )
  select
    p.ref_code, p.id, p.listing_id, l.slug, l.title, l.price,
    l.commission_type, l.commission_value, l.category, l.location,
    (select li.url from public.listing_images li where li.listing_id = l.id order by li.sort_order asc limit 1),
    coalesce(p.agreed_attribution_window_days, l.attribution_window_days, 30),
    now()
  from public.partnerships p
  join public.listings l on l.id = p.listing_id
  where p.id = target_partnership_id
    and p.status = 'active'
    and l.status = 'active'
  on conflict (ref_code) do update set
    partnership_id = excluded.partnership_id,
    listing_id = excluded.listing_id,
    slug = excluded.slug,
    title = excluded.title,
    price = excluded.price,
    commission_type = excluded.commission_type,
    commission_value = excluded.commission_value,
    category = excluded.category,
    location = excluded.location,
    image_url = excluded.image_url,
    agreed_attribution_window_days = excluded.agreed_attribution_window_days,
    updated_at = now();
end;
$function$;

-- Mevcut satırları geri-doldur (yoksa eski linkler pencereyi taşımaz).
update public.referral_public_links r
set agreed_attribution_window_days = coalesce(p.agreed_attribution_window_days, l.attribution_window_days, 30)
from public.partnerships p
join public.listings l on l.id = p.listing_id
where p.id = r.partnership_id
  and r.agreed_attribution_window_days is distinct from
      coalesce(p.agreed_attribution_window_days, l.attribution_window_days, 30);

-- ---------------------------------------------------------------------------
-- F5 (devam): ortak vitrini de ANLAŞILAN atıf penceresini taşısın.
-- Dönüş TABLE imzası değiştiği için drop+create (tek batch = atomik).
-- ---------------------------------------------------------------------------
drop function if exists public.partner_public_shop(uuid);
create function public.partner_public_shop(p_id uuid)
returns table(listing_id uuid, ref_code text, partnership_id uuid, agreed_attribution_window_days int)
language sql stable security definer set search_path to 'public'
as $fn$
  select pt.listing_id, pt.ref_code, pt.id,
         coalesce(pt.agreed_attribution_window_days, l.attribution_window_days, 30)
    from partnerships pt
    join listings l on l.id = pt.listing_id
    where pt.partner_id = p_id and pt.status = 'active' and l.status = 'active'
    order by l.created_at desc
    limit 200;
$fn$;
grant execute on function public.partner_public_shop(uuid) to anon, authenticated;

