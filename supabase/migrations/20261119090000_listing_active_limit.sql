-- Ücretsiz ilan hakkı: kullanıcı başına en fazla 10 açık ilan + aynı ilanı tekrar tekrar açma engeli (2026-11-19).
--
-- Sorun: kullanıcılar aynı ilanları defalarca veriyordu. OrtakSat ücret almadığı için "ek ilan paketi" satılmaz;
-- sınır sabittir, ek hak yalnız yöneticinin tanıdığı hesaplara (kurumsal/XML akışı) verilir.
--
-- "Açık ilan" = hak kullanan durumlar: active, pending_review, paused, draft.
-- Satıldı / süresi doldu / reddedildi / arşiv hak kullanmaz → satıcı yer açmak için ilanını kaldırır ya da Satıldı yapar.
-- Sınır HEM eklemede HEM hak kullanmayan durumdan hak kullanan duruma geçişte (ör. süresi dolan ilanı yenileme) uygulanır.
-- XML akışı (service_role, auth.uid() null) de sınıra tabidir; yoksa akış kurarak sınır atlatılırdı.
-- Muaf: çağıran yönetici, ilan sahibi yönetici/moderatör.

create table if not exists public.listing_quota_overrides (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  max_open int not null check (max_open between 0 and 100000),
  note text,
  granted_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.listing_quota_overrides enable row level security;
revoke all on public.listing_quota_overrides from anon, authenticated;
grant select on public.listing_quota_overrides to authenticated;
drop policy if exists listing_quota_overrides_read on public.listing_quota_overrides;
create policy listing_quota_overrides_read on public.listing_quota_overrides
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

create or replace function private.listing_open_limit(p_owner uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when exists (select 1 from public.profiles where id = p_owner and role in ('moderator','admin','super_admin')) then null
    else coalesce((select max_open from public.listing_quota_overrides where user_id = p_owner), 10)
  end;
$$;

create or replace function private.normalize_listing_title(p text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(translate(coalesce(p, ''), 'İIıĞğÜüŞşÖöÇç', 'iiigguussoocc')), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function private.enforce_listing_open_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_limit int;
  v_used int;
  v_open constant text[] := array['active','pending_review','paused','draft'];
begin
  if new.owner_id is null or not (new.status::text = any(v_open)) then
    return new;
  end if;
  -- Yalnız hak kullanmayan durumdan (ya da yeni kayıttan) hak kullanan duruma geçiş sayılır.
  if tg_op = 'UPDATE' and old.status::text = any(v_open) then
    return new;
  end if;
  if auth.uid() is not null and public.is_admin() then
    return new;
  end if;

  -- Aynı ilan tekrar: sahibinin açık ilanları arasında aynı başlık varsa reddedilir.
  if tg_op = 'INSERT' and exists (
    select 1 from public.listings
    where owner_id = new.owner_id
      and id <> new.id
      and status::text = any(v_open)
      and private.normalize_listing_title(title) = private.normalize_listing_title(new.title)
  ) then
    raise exception 'Bu ilan zaten yayında. Aynı ilanı tekrar veremezsin; mevcut ilanını düzenleyebilirsin.'
      using errcode = 'P0001', hint = 'duplicate_listing';
  end if;

  v_limit := private.listing_open_limit(new.owner_id);
  if v_limit is null then
    return new;
  end if;

  -- Aynı sahip için eşzamanlı eklemeleri sıraya sok (çift tıklama / toplu yüklemede sınırın aşılmaması için).
  perform pg_advisory_xact_lock(hashtext('listing_open_limit:' || new.owner_id::text));
  select count(*) into v_used from public.listings
    where owner_id = new.owner_id and id <> new.id and status::text = any(v_open);
  if v_used >= v_limit then
    raise exception 'İlan sınırına ulaştın (% / %). Yeni ilan vermek için yayındaki ilanlarından birini kaldır ya da Satıldı olarak işaretle.', v_used, v_limit
      using errcode = 'P0001', hint = 'listing_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listing_open_limit on public.listings;
create trigger trg_listing_open_limit
  before insert or update of status on public.listings
  for each row execute function private.enforce_listing_open_limit();

-- Kullanıcının kendi hakkı (arayüzde "7 / 10 ilan hakkı" ve sınır ekranı için).
create or replace function public.my_listing_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int;
  v_used int;
begin
  if v_uid is null then
    return null;
  end if;
  v_limit := private.listing_open_limit(v_uid);
  select count(*) into v_used from public.listings
    where owner_id = v_uid and status::text in ('active','pending_review','paused','draft');
  return jsonb_build_object(
    'used', v_used,
    'limit', v_limit,
    'remaining', case when v_limit is null then null else greatest(v_limit - v_used, 0) end
  );
end;
$$;
revoke all on function public.my_listing_quota() from public, anon;
grant execute on function public.my_listing_quota() to authenticated;

-- Yönetici: belirli bir hesaba ek ilan hakkı tanır (p_max null → varsayılan 10'a döner).
create or replace function public.admin_set_listing_limit(p_user uuid, p_max int, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  if p_max is null then
    delete from public.listing_quota_overrides where user_id = p_user;
  else
    insert into public.listing_quota_overrides (user_id, max_open, note, granted_by, updated_at)
    values (p_user, p_max, nullif(trim(coalesce(p_note, '')), ''), auth.uid(), now())
    on conflict (user_id) do update
      set max_open = excluded.max_open, note = excluded.note, granted_by = excluded.granted_by, updated_at = now();
  end if;
end;
$$;
revoke all on function public.admin_set_listing_limit(uuid, int, text) from public, anon;
grant execute on function public.admin_set_listing_limit(uuid, int, text) to authenticated;

revoke all on function private.listing_open_limit(uuid) from public, anon, authenticated;
revoke all on function private.enforce_listing_open_limit() from public, anon, authenticated;
