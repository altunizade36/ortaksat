-- OrtakSat — Faz: Yetkilendirme & audit log + değişmez ortaklık şartları (hardening)

-- 1) DEĞİŞMEZLİK: agreed_* şartları bir kez kilitlenince ASLA değişmez.
--    (Önceki snapshot yalnız agreed_at IS NULL iken yazıyordu; kilitten sonra
--     ilan sahibi UPDATE policy'siyle agreed_* değerlerini ezebiliyordu — kapatıldı.)
create or replace function public.trg_snapshot_partnership_terms()
returns trigger language plpgsql as $$
begin
  -- Ortaklık AKTİF olduğunda ilan şartlarını KİLİTLE (bir kez, ilandan; istemci ezilmez).
  if new.status = 'active' and new.agreed_at is null then
    select commission_type, commission_value, commission_tiers, attribution_window_days, return_window_days, commission_due_days
      into new.agreed_commission_type, new.agreed_commission_value, new.agreed_commission_tiers,
           new.agreed_attribution_window_days, new.agreed_return_window_days, new.agreed_commission_due_days
      from public.listings where id = new.listing_id;
    new.agreed_at := now();
  end if;
  -- Kilitten sonra (agreed_at set) tüm agreed_* alanları OLD'dan korunur → tamper imkânsız.
  if tg_op = 'UPDATE' and old.agreed_at is not null then
    new.agreed_at                       := old.agreed_at;
    new.agreed_commission_type          := old.agreed_commission_type;
    new.agreed_commission_value         := old.agreed_commission_value;
    new.agreed_commission_tiers         := old.agreed_commission_tiers;
    new.agreed_attribution_window_days  := old.agreed_attribution_window_days;
    new.agreed_return_window_days       := old.agreed_return_window_days;
    new.agreed_commission_due_days      := old.agreed_commission_due_days;
  end if;
  return new;
end; $$;

-- 2) SUNUCU-TARAFLI AUDIT LOG: hassas para/ortaklık geçişleri tamper-kanıtlı kaydedilir.
--    SECURITY DEFINER → RLS'i aşarak yazar; activity_logs'ta UPDATE/DELETE policy YOK
--    (append-only), okuma admin/own → sağlam denetim izi. auth.uid() = gerçek aktör.

create or replace function public.audit_partnership_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_logs(user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'partnership_'||new.status, 'partnership', new.id::text,
      jsonb_build_object('listing_id', new.listing_id, 'partner_id', new.partner_id, 'status', new.status));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into activity_logs(user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'partnership_'||new.status, 'partnership', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status, 'listing_id', new.listing_id, 'partner_id', new.partner_id));
    end if;
    -- Şartların kilitlenmesi ayrı bir denetim olayı.
    if new.agreed_at is not null and old.agreed_at is null then
      insert into activity_logs(user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'partnership_terms_locked', 'partnership', new.id::text,
        jsonb_build_object('commission_type', new.agreed_commission_type, 'commission_value', new.agreed_commission_value,
                           'attribution_window_days', new.agreed_attribution_window_days));
    end if;
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists trg_audit_partnership on public.partnerships;
create trigger trg_audit_partnership
  after insert or update on public.partnerships
  for each row execute function public.audit_partnership_change();

create or replace function public.audit_commission_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_logs(user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'commission_created', 'commission', new.id::text,
      jsonb_build_object('partnership_id', new.partnership_id, 'listing_id', new.listing_id,
                         'amount', new.amount, 'status', new.status));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into activity_logs(user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'commission_'||new.status, 'commission', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status, 'partnership_id', new.partnership_id, 'amount', new.amount));
    end if;
    if new.buyer_confirmed_at is not null and old.buyer_confirmed_at is null then
      insert into activity_logs(user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'commission_buyer_confirmed', 'commission', new.id::text,
        jsonb_build_object('buyer_confirm_status', new.buyer_confirm_status, 'partnership_id', new.partnership_id));
    end if;
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists trg_audit_commission on public.commissions;
create trigger trg_audit_commission
  after insert or update on public.commissions
  for each row execute function public.audit_commission_change();
