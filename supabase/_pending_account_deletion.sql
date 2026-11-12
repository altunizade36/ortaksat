-- Hesap silme: talep → 30 gün askı (iptal edilebilir) → kalıcı anonimleştirme (2026-11-12)
-- Eskiden yalnız account_deletion_requests satırı ekleniyordu; onu işleyen hiçbir şey yoktu
-- (Apple 5.1.1(v) / Google Play hesap silme politikası / KVKK).
--
-- Akış:
--   INSERT (istemci ya da request_account_deletion RPC) → BEFORE INSERT tetikleyici:
--     profil 'suspended', aktif ilanlar 'paused' (hangileri olduğu satıra yazılır), push token silinir
--   cancel_account_deletion()  → profil ve ilanlar eski haline döner
--   günlük cron                → 30 günü dolan talepler için private.finalize_account_deletion
--   admin_resolve_account_deletion(id, 'reject' | 'delete_now')
begin;

alter table public.account_deletion_requests
  add column if not exists prior_status text,
  add column if not exists paused_listing_ids uuid[] not null default '{}',
  add column if not exists closed_note text;

create unique index if not exists account_deletion_requests_one_open
  on public.account_deletion_requests (user_id) where status = 'open';

-- Durum değişikliği normalde yalnız yönetimindir; hesap silme akışı güvenilir bayrakla geçer.
create or replace function private.prevent_profile_role_escalation() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  if coalesce(current_setting('app.trusted_status_update', true), '') = 'on'
     and new.role is not distinct from old.role then
    return new;
  end if;
  if not public.is_admin()
     and (new.role is distinct from old.role or new.status is distinct from old.status)
  then
    raise exception 'Only admins can update profile role or status';
  end if;
  return new;
end;
$function$;

create or replace function private.account_deletion_on_request() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_status text; v_paused uuid[];
begin
  -- İstemci alanları güvenilmez: tarih geriye çekilip 30 günlük süre atlanamasın.
  new.status := 'open';
  new.requested_at := now();
  new.completed_at := null;
  new.closed_note := null;
  new.reason := left(coalesce(new.reason, ''), 1000);
  select status into v_status from public.profiles where id = new.user_id for update;
  if v_status is null or v_status = 'deleted' then
    raise exception 'Hesap bulunamadı.' using errcode = '22023';
  end if;
  new.prior_status := v_status;
  with paused as (
    update public.listings set status = 'paused'
      where owner_id = new.user_id and status = 'active'
      returning id)
  select coalesce(array_agg(id), '{}') into v_paused from paused;
  new.paused_listing_ids := v_paused;
  perform set_config('app.trusted_status_update', 'on', true);
  update public.profiles set status = 'suspended' where id = new.user_id and status = 'active';
  perform set_config('app.trusted_status_update', '', true);
  delete from public.push_tokens where user_id = new.user_id;
  return new;
end $$;
revoke all on function private.account_deletion_on_request() from public, anon, authenticated;

drop trigger if exists account_deletion_on_request on public.account_deletion_requests;
create trigger account_deletion_on_request before insert on public.account_deletion_requests
  for each row execute function private.account_deletion_on_request();

create or replace function private.restore_after_deletion_cancel(p_request public.account_deletion_requests) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform set_config('app.trusted_status_update', 'on', true);
  -- Yalnız talep ÖNCESİ aktif olan hesap geri açılır (yönetimin askıya aldığı hesap kendini açamaz).
  update public.profiles set status = 'active'
    where id = p_request.user_id and status = 'suspended' and coalesce(p_request.prior_status, 'active') = 'active';
  perform set_config('app.trusted_status_update', '', true);
  if coalesce(p_request.prior_status, 'active') = 'active' then
    update public.listings set status = 'active'
      where id = any (p_request.paused_listing_ids) and owner_id = p_request.user_id and status = 'paused';
  end if;
end $$;
revoke all on function private.restore_after_deletion_cancel(public.account_deletion_requests) from public, anon, authenticated;

create or replace function public.request_account_deletion(p_reason text default '') returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_req public.account_deletion_requests;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  select * into v_req from public.account_deletion_requests where user_id = v_uid and status = 'open';
  if not found then
    insert into public.account_deletion_requests (user_id, reason) values (v_uid, coalesce(p_reason, ''))
      returning * into v_req;
  end if;
  return jsonb_build_object('ok', true, 'pending', true, 'requested_at', v_req.requested_at,
                            'scheduled_for', v_req.requested_at + interval '30 days');
end $$;

create or replace function public.my_account_deletion() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select jsonb_build_object('pending', true, 'requested_at', r.requested_at,
                              'scheduled_for', r.requested_at + interval '30 days')
    from public.account_deletion_requests r
    where r.user_id = (select auth.uid()) and r.status = 'open'
    limit 1), jsonb_build_object('pending', false));
$$;

create or replace function public.cancel_account_deletion() returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_req public.account_deletion_requests;
begin
  if v_uid is null then return false; end if;
  update public.account_deletion_requests
    set status = 'rejected', completed_at = now(), closed_note = 'user_cancelled'
    where user_id = v_uid and status = 'open'
    returning * into v_req;
  if not found then return false; end if;
  perform private.restore_after_deletion_cancel(v_req);
  return true;
end $$;

-- Kalıcı silme: kişisel veriler temizlenir, giriş imkânsız hale gelir; komisyon/sipariş/mesaj
-- geçmişi (karşı tarafın kaydı ve mali iz) anonim profile bağlı olarak korunur.
create or replace function private.finalize_account_deletion(p_user uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if p_user is null then return; end if;
  perform set_config('app.trusted_status_update', 'on', true);
  perform set_config('app.trusted_rating_update', 'on', true);
  update public.profiles set
    full_name = 'Silinmiş Kullanıcı', phone = null, avatar_url = null, bio = '',
    verified_phone = false, verified_identity = false, verified_instagram = false,
    preferences = '{}'::jsonb, email_notifications = false, expertise_categories = '{}',
    city = null, username = null, district_id = null, website_url = null, instagram_handle = null,
    invited_by = null, last_seen_at = null, status = 'deleted'
  where id = p_user;
  perform set_config('app.trusted_rating_update', '', true);
  perform set_config('app.trusted_status_update', '', true);

  update public.listings set status = 'archived' where owner_id = p_user and status <> 'archived';
  update public.partnerships set status = 'cancelled' where partner_id = p_user and status in ('active', 'pending');
  update public.offers set status = 'withdrawn', responded_at = now() where buyer_id = p_user and status in ('pending', 'countered');
  update public.offers set status = 'rejected', responded_at = now() where seller_id = p_user and status = 'pending';

  delete from public.push_tokens where user_id = p_user;
  delete from public.favorites where user_id = p_user;
  delete from public.follows where follower_id = p_user or seller_id = p_user;
  delete from public.blocked_users where blocker_id = p_user or blocked_id = p_user;
  delete from public.notifications where user_id = p_user;

  -- Kimlik: e-posta/telefon/parola/sosyal kimlik silinir, oturumlar kapatılır, hesap kalıcı kilitlenir.
  delete from auth.sessions where user_id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.identities where user_id = p_user;
  update auth.users set
    email = 'deleted-' || p_user::text || '@deleted.invalid',
    phone = null, encrypted_password = null,
    raw_user_meta_data = '{}'::jsonb,
    email_change = '', email_change_token_new = '', email_change_token_current = '',
    confirmation_token = '', recovery_token = '',
    banned_until = 'infinity'
  where id = p_user;
end $$;
revoke all on function private.finalize_account_deletion(uuid) from public, anon, authenticated;

create or replace function private.process_account_deletions() returns integer
language plpgsql security definer set search_path to 'public' as $$
declare r record; v_done int := 0;
begin
  for r in select id, user_id from public.account_deletion_requests
           where status = 'open' and requested_at < now() - interval '30 days'
           order by requested_at limit 200
  loop
    begin
      perform private.finalize_account_deletion(r.user_id);
      update public.account_deletion_requests
        set status = 'completed', completed_at = now(), closed_note = 'auto_after_30_days'
        where id = r.id;
      v_done := v_done + 1;
    exception when others then
      update public.account_deletion_requests set closed_note = left('error: ' || sqlerrm, 300) where id = r.id;
    end;
  end loop;
  return v_done;
end $$;
revoke all on function private.process_account_deletions() from public, anon, authenticated;

-- Yönetim kuyruğu
create or replace function public.admin_account_deletions() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'userId', r.user_id, 'name', p.full_name, 'reason', r.reason, 'status', r.status,
      'requestedAt', r.requested_at, 'scheduledFor', r.requested_at + interval '30 days',
      'completedAt', r.completed_at, 'note', r.closed_note,
      'listingCount', (select count(*) from public.listings l where l.owner_id = r.user_id)
    ) order by (r.status = 'open') desc, r.requested_at desc)
    from (select * from public.account_deletion_requests order by requested_at desc limit 300) r
    left join public.profiles p on p.id = r.user_id), '[]'::jsonb);
end $$;

create or replace function public.admin_resolve_account_deletion(p_id uuid, p_action text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_req public.account_deletion_requests; v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid() and status = 'active';
  if coalesce(v_role, '') not in ('admin', 'super_admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_req from public.account_deletion_requests where id = p_id and status = 'open' for update;
  if not found then return false; end if;
  if v_req.user_id = auth.uid() then raise exception 'own request' using errcode = '42501'; end if;
  if p_action = 'reject' then
    update public.account_deletion_requests
      set status = 'rejected', completed_at = now(), closed_note = 'admin_rejected' where id = p_id;
    perform private.restore_after_deletion_cancel(v_req);
    return true;
  elsif p_action = 'delete_now' then
    perform private.finalize_account_deletion(v_req.user_id);
    update public.account_deletion_requests
      set status = 'completed', completed_at = now(), closed_note = 'admin_immediate' where id = p_id;
    return true;
  end if;
  return false;
end $$;

revoke all on function public.request_account_deletion(text) from public, anon;
revoke all on function public.my_account_deletion() from public, anon;
revoke all on function public.cancel_account_deletion() from public, anon;
revoke all on function public.admin_account_deletions() from public, anon;
revoke all on function public.admin_resolve_account_deletion(uuid, text) from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.my_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.admin_account_deletions() to authenticated;
grant execute on function public.admin_resolve_account_deletion(uuid, text) to authenticated;

-- İstemci artık satırı doğrudan güncelleyemez (yalnız RPC'ler); kendi talebini okuyabilir.
revoke update, delete on public.account_deletion_requests from authenticated, anon;

commit;

-- HENÜZ ZAMANLANMADI (sahibin onayı bekleniyor): 30 günü dolan talepleri her gece işleyen görev.
-- Onaylanınca Supabase SQL Editor'da tek satır olarak çalıştırılır:
--   select cron.schedule('process-account-deletions', '25 3 * * *', 'select private.process_account_deletions()');
-- O zamana kadar kalıcı silme yalnız yönetim panelinden ("Şimdi sil") yapılabilir.
