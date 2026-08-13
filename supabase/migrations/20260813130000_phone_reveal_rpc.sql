-- PII sertleştirme (2026-08-13): telefon toplu-kazımayı engelle.
-- BULGU: profiles SELECT policy'si `USING true` (tüm satırlar) + `authenticated` role'ünde
-- `phone` kolon-SELECT grant'ı var → HERHANGİ bir girişli kullanıcı
-- `select id, phone from profiles` ile TÜM telefonları toplayabiliyordu (reveal akışını
-- baypas ederek). PUBLIC_PROFILE_COLUMNS phone içermez ama doğrudan grant açıktı.
--
-- ÇÖZÜM: telefon açığa çıkarma tek bir SECURITY DEFINER RPC'ye taşınır; doğrudan kolon
-- grant'ı geri alınır. Reveal RPC hâlâ tek-tek (id başına) çalışır (pazaryeri iletişimi
-- korunur) ama `select phone from profiles` (toplu) artık BOŞ döner.

create or replace function public.reveal_seller_phone(p_seller uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  -- Yalnız girişli kullanıcıya, tek satıcı için telefon döner (toplu kazıma yok).
  select p.phone
  from public.profiles p
  where p.id = p_seller
    and auth.uid() is not null;
$$;

comment on function public.reveal_seller_phone(uuid) is
  'İletişim anında tek satıcının telefonunu döner (girişli kullanıcı). Toplu profiles.phone SELECT grant''i kaldırıldığı için tek erişim yolu budur.';

-- Reveal RPC yalnız girişli (authenticated) kullanıcıya açık.
revoke execute on function public.reveal_seller_phone(uuid) from public, anon;
grant execute on function public.reveal_seller_phone(uuid) to authenticated;

-- Doğrudan telefon erişimini kapat. `authenticated` TABLO-düzeyinde SELECT'e sahip
-- (tüm kolonlar) → kolon-düzeyi revoke NO-OP. Doğru yol: tablo SELECT'i geri al, sonra
-- phone HARİÇ tüm kolonları geri ver. (anon zaten kolon-düzeyi grant'lı ve phone içermez.)
-- RPC (DEFINER) sahip yetkisiyle okur → reveal etkilenmez. Own-phone public kolonlardan
-- gelir (phone yok) → own-görünüm etkilenmez.
revoke select on public.profiles from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by column_name)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name <> 'phone';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;
