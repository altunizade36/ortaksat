-- REGRESYON DÜZELTMESİ (2026-08-13): own-profile yüklemesi.
-- 20260813130000 phone kolon-grant'ını authenticated'tan kaldırdı → `profiles.select("*")`
-- artık "permission denied for column phone" veriyor. data/app-store.tsx loadProfile TAM da
-- `select("*")` kullanıyordu → sorgu hata verip fallback profile'a düşüyor → role="user" →
-- ADMIN linki + own phone/preferences KAYBOLUYOR (her girişli kullanıcıda).
--
-- ÇÖZÜM: own profil'i SECURITY DEFINER RPC ile getir (yalnız auth.uid()'in KENDİ satırı;
-- phone dahil tüm kolonlar; sahip yetkisiyle okur → kolon-grant'ı önemsiz, sızıntı yok).

create or replace function public.get_my_profile()
returns setof public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles where id = auth.uid();
$$;

comment on function public.get_my_profile() is
  'Girişli kullanıcının KENDİ tam profilini döner (phone dahil). phone kolon-grant''ı güvenlik için kaldırıldığından own-profile yüklemesi bununla yapılır.';

revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
