-- Ortak, kendi hunisindeki (partnership sahibi olduğu) lead'in DURUMUNU
-- ilerletebilsin (arandı/ilgileniyor/kayıp). Satıcı zaten tüm alanları
-- güncelleyebiliyor ("listing owners update leads"). Ortağın yalnızca `status`
-- değiştirebilmesi için kolon-koruma trigger'ı eklenir; satıcı ve service_role
-- etkilenmez.

create policy "lead partners update status" on leads for update
  using (exists (select 1 from partnerships p where p.id = leads.partnership_id and p.partner_id = auth.uid()))
  with check (exists (select 1 from partnerships p where p.id = leads.partnership_id and p.partner_id = auth.uid()));

create or replace function guard_partner_lead_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- service_role / JWT'siz sunucu bağlamı: dokunma.
  if auth.uid() is null then return new; end if;
  -- İlan sahibi (satıcı): tüm alanları değiştirebilir.
  if exists (select 1 from listings l where l.id = new.listing_id and l.owner_id = auth.uid()) then
    return new;
  end if;
  -- Diğer güncelleyiciler (ortak): yalnızca status.
  if new.buyer_name is distinct from old.buyer_name
     or new.buyer_phone is distinct from old.buyer_phone
     or new.note is distinct from old.note
     or new.partnership_id is distinct from old.partnership_id
     or new.listing_id is distinct from old.listing_id
     or new.source is distinct from old.source
     or new.intent is distinct from old.intent then
    raise exception 'Ortak yalnizca talep durumunu degistirebilir';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_partner_lead_update on leads;
create trigger trg_guard_partner_lead_update before update on leads
  for each row execute function guard_partner_lead_update();
