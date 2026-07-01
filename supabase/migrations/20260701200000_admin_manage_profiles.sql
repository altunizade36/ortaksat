-- Adminlerin baska kullanicilarin profilini (rol/durum) guncelleyebilmesi icin
-- RLS politikasi. Mevcut "users update own profile" yalniz kendi satirina izin
-- veriyordu; admin panelinden rol/askiya alma calismasi icin bu gerekli.
-- Rol/durum degisimini yalniz admin yapabilir kurali harden_profile_roles
-- trigger'inda zaten korunuyor.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'admins update any profile'
  ) then
    create policy "admins update any profile" on public.profiles
      for update using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
