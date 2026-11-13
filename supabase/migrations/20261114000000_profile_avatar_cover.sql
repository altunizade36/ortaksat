-- Profil fotoğrafı her yerde görünsün + kişiye özel kapak görseli.
--
-- 1) Google/Apple ile gelen profil fotoğrafı yalnız oturum bilgisinde kalıyor, profiles.avatar_url'e
--    yazılmıyordu → kullanıcı kendi fotoğrafını görüyor, BAŞKALARI (ana sayfa, mağaza, ortak listesi)
--    boş siluet görüyordu. Kayıt anında ve fotoğraf ilk kez geldiğinde profile yazılır; eskiler doldurulur.
-- 2) avatar_url'e adres olmayan metin yazılabiliyordu (canlıda bir satırda mahalle adı vardı) → süzülür.
-- 3) profiles.cover_url: kullanıcının kendi yüklediği kapak (yoksa herkes standart kapağı görür).

alter table public.profiles add column if not exists cover_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_cover_url_https') then
    alter table public.profiles add constraint profiles_cover_url_https
      check (cover_url is null or (char_length(cover_url) <= 600 and cover_url ~ '^https://'));
  end if;
end $$;

-- Sütun bazlı yetki: herkese açık profil okumaları sütun listesiyle yapılır (yetki yoksa tüm sorgu 401 olur).
grant select (cover_url) on public.profiles to anon, authenticated;
grant update (cover_url) on public.profiles to authenticated;

-- Adres olmayan değer profil fotoğrafı olamaz.
create or replace function private.sanitize_profile_media()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.avatar_url is not null and new.avatar_url !~* '^https?://' then
    new.avatar_url := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sanitize_profile_media on public.profiles;
create trigger trg_sanitize_profile_media
  before insert or update of avatar_url on public.profiles
  for each row execute function private.sanitize_profile_media();

update public.profiles set avatar_url = null where avatar_url is not null and avatar_url !~* '^https?://';

-- Sağlayıcıdan (Google) gelen fotoğraf adresi.
create or replace function private.provider_photo(meta jsonb)
returns text
language sql
immutable
as $$
  select case when v ~* '^https://' and char_length(v) <= 600 then v end
  from (select coalesce(nullif(btrim(meta ->> 'avatar_url'), ''), nullif(btrim(meta ->> 'picture'), '')) as v) s;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  consent_version text := coalesce(new.raw_user_meta_data ->> 'legal_version', '2026-06-11');
  consent_accepted_at timestamptz := coalesce(nullif(new.raw_user_meta_data ->> 'legal_accepted_at', '')::timestamptz, now());
begin
  insert into public.profiles (id, full_name, phone, verified_phone, avatar_url)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'OrtakSat Kullanıcısı'),
    new.phone,
    new.phone is not null,
    private.provider_photo(new.raw_user_meta_data)
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = excluded.phone,
    verified_phone = excluded.verified_phone,
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  if lower(coalesce(new.raw_user_meta_data ->> 'legal_terms_accepted', 'false')) in ('true', '1', 'yes') then
    insert into public.legal_consents (user_id, document_type, version, accepted, accepted_at)
    select new.id, document_type, consent_version, true, consent_accepted_at
    from unnest(array['privacy', 'terms', 'kvkk', 'seller_rules']) as document_type
    on conflict (user_id, document_type, version) do update set
      accepted = excluded.accepted,
      accepted_at = excluded.accepted_at;
  end if;

  return new;
end;
$$;

-- Fotoğraf sonradan ilk kez gelirse (e-postayla açılmış hesaba Google bağlanması) ve profilde fotoğraf
-- yoksa yazılır. Kullanıcının kendi seçtiği fotoğrafın üzerine ASLA yazılmaz; fotoğrafını kaldıran
-- kullanıcıya da geri yüklenmez (yalnız "önceden yoktu → şimdi var" geçişinde çalışır).
create or replace function private.sync_provider_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.provider_photo(old.raw_user_meta_data) is null and private.provider_photo(new.raw_user_meta_data) is not null then
    update public.profiles set avatar_url = private.provider_photo(new.raw_user_meta_data)
    where id = new.id and avatar_url is null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_photo on auth.users;
create trigger on_auth_user_photo
  after update of raw_user_meta_data on auth.users
  for each row execute function private.sync_provider_photo();

-- Eski hesaplar: sağlayıcı fotoğrafı olup profili boş olanlar.
update public.profiles p
set avatar_url = private.provider_photo(u.raw_user_meta_data)
from auth.users u
where u.id = p.id and p.avatar_url is null and private.provider_photo(u.raw_user_meta_data) is not null;

-- Giriş anındaki profil güvencesi artık var olan fotoğrafı boşla ezmez ve adres olmayan değeri yazmaz.
create or replace function public.ensure_my_profile(p_full_name text, p_phone text, p_avatar_url text, p_bio text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.profiles (id, full_name, phone, avatar_url, bio)
  values (auth.uid(), p_full_name, p_phone, case when p_avatar_url ~* '^https?://' then p_avatar_url end, p_bio)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone     = excluded.phone,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    bio       = excluded.bio;
$$;
