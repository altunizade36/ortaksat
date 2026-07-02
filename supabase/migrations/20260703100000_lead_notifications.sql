-- Talep (lead) bildirimleri — DB tarafında tek kaynak.
-- Böylece hem uygulama içi talepler hem de REFERANS LİNKİNDEN gelen (anonim)
-- talepler, kimin oluşturduğundan bağımsız olarak satıcı + ortağa bildirim üretir.
-- SECURITY DEFINER: RLS'i aşarak başka kullanıcı adına notifications yazabilir.

create or replace function public.create_notification(p_user uuid, p_type text, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, read, created_at)
  values (p_user, p_type, p_title, p_body, false, now());
end;
$$;

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
begin
  select owner_id, title into v_owner, v_title from public.listings where id = NEW.listing_id;
  select partner_id into v_partner from public.partnerships where id = NEW.partnership_id;

  -- Satıcıya: yeni talep geldi
  perform public.create_notification(
    v_owner,
    'lead',
    'Yeni müşteri talebi',
    coalesce(NEW.buyer_name, 'Bir alıcı') || ' — "' || coalesce(v_title, 'ilanın') || '" için talep oluşturdu. Hızlı dönüş performansını artırır.'
  );

  -- Ortağa: getirdiğin talep iletildi (kendi getirmediği durumda bile bilgilenir)
  perform public.create_notification(
    v_partner,
    'lead',
    'Getirdiğin talep iletildi',
    '"' || coalesce(v_title, 'ilan') || '" için paylaştığın bağlantıdan bir alıcı talebi oluştu.'
  );

  return NEW;
end;
$$;

drop trigger if exists notify_on_lead_insert on public.leads;
create trigger notify_on_lead_insert
  after insert on public.leads
  for each row execute function public.notify_on_lead();
