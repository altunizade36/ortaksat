-- Talep (lead) bildirimlerine YAPISAL METADATA ekle: listingId / leadId / partnershipId.
-- Böylece istemci bir bildirimi ilgili ilana/talebe/ortaklığa götürebilir (derin link) —
-- şu an sadece title/body vardı. Additive ve idempotent; mevcut realtime akışı bozulmaz
-- (yeni kolon nullable-default '{}'; eski kayıtlar boş metadata alır, select * kırılmaz).
--
-- NOT: create_notification imzası 4 -> 5 argümana çıkıyor. Overload ambiguity olmasın
-- diye eski 4-arg sürüm önce DROP edilir (tek çağıranı notify_on_lead'dir, o da bu
-- migration'da 5-arg'a güncellenir). Duplicate bildirim davranışı DEĞİŞMEZ: trigger
-- her lead satırında bir kez çalışır (satıcıya 1 + ortağa 1); istemci canlı modda
-- ayrıca notify çağırmaz, yani çift bildirim yoktur.

-- 1) notifications tablosuna metadata kolonu (jsonb, varsayılan boş nesne).
alter table public.notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2) Eski 4-arg create_notification'ı düşür (imza değişimi için gerekli).
drop function if exists public.create_notification(uuid, text, text, text);

-- 3) Metadata destekli create_notification (p_meta varsayılan '{}').
create or replace function public.create_notification(
  p_user uuid,
  p_type text,
  p_title text,
  p_body text,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, read, metadata, created_at)
  values (p_user, p_type, p_title, p_body, false, coalesce(p_meta, '{}'::jsonb), now());
end;
$$;

-- 4) notify_on_lead: satıcı + ortağa bildirim, artık metadata ile.
create or replace function public.notify_on_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
  v_partner uuid;
  v_meta jsonb;
begin
  select owner_id, title into v_owner, v_title from public.listings where id = NEW.listing_id;
  select partner_id into v_partner from public.partnerships where id = NEW.partnership_id;

  v_meta := jsonb_build_object(
    'listingId', NEW.listing_id,
    'leadId', NEW.id,
    'partnershipId', NEW.partnership_id
  );

  -- Satıcıya: yeni talep geldi
  perform public.create_notification(
    v_owner,
    'lead',
    'Yeni müşteri talebi',
    coalesce(NEW.buyer_name, 'Bir alıcı') || ' — "' || coalesce(v_title, 'ilanın') || '" için talep oluşturdu. Hızlı dönüş performansını artırır.',
    v_meta
  );

  -- Ortağa: getirdiğin talep iletildi (kendi getirmese bile bilgilenir)
  perform public.create_notification(
    v_partner,
    'lead',
    'Getirdiğin talep iletildi',
    '"' || coalesce(v_title, 'ilan') || '" için paylaştığın bağlantıdan bir alıcı talebi oluştu.',
    v_meta
  );

  return NEW;
end;
$$;

-- Trigger zaten notify_on_lead()'e bağlı (20260703100000). Fonksiyon create-or-replace
-- ile güncellendiğinden trigger'ı yeniden oluşturmaya gerek yok; yine de güvenli tekrar:
drop trigger if exists notify_on_lead_insert on public.leads;
create trigger notify_on_lead_insert
  after insert on public.leads
  for each row execute function public.notify_on_lead();
