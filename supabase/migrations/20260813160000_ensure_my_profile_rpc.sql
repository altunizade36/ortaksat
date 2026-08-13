-- REGRESYON DÜZELTMESİ (2026-08-13): profil upsert 403.
-- 20260813130000 profiles TABLO-SELECT'ini authenticated'tan alıp KOLON-SELECT verdi (phone hariç).
-- PostgreSQL UPSERT'i (INSERT ... ON CONFLICT DO UPDATE) TABLO-düzeyi SELECT ister → artık
-- authenticated'ta yok → ensureProfile upsert'i "permission denied for table profiles" (42501).
-- (Düz UPDATE tablo-SELECT istemez → o akışlar çalışıyor; yalnız upsert kırıldı.)
--
-- ÇÖZÜM: own-profil upsert'ini SECURITY DEFINER RPC ile yap (sahip yetkisiyle → grant sorunu yok;
-- yalnız auth.uid()'in KENDİ satırı yazılır → yeni risk yok).

create or replace function public.ensure_my_profile(
  p_full_name text,
  p_phone text,
  p_avatar_url text,
  p_bio text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.profiles (id, full_name, phone, avatar_url, bio)
  values (auth.uid(), p_full_name, p_phone, p_avatar_url, p_bio)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone     = excluded.phone,
    avatar_url = excluded.avatar_url,
    bio       = excluded.bio;
$$;

comment on function public.ensure_my_profile(text, text, text, text) is
  'Girişli kullanıcının KENDİ profilini upsert eder (id=auth.uid()). phone kolon-SELECT grant''ı kaldırıldığından düz upsert 403 verdiği için DEFINER RPC.';

revoke execute on function public.ensure_my_profile(text, text, text, text) from public, anon;
grant execute on function public.ensure_my_profile(text, text, text, text) to authenticated;
