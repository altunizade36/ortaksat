-- Adminlerin TUM ilanlari (aktif/pasif/incelemede/reddedilmis) okuyabilmesi icin
-- select politikasi. Moderasyon kuyrugu ve ilan yonetimi bunu gerektirir; onceki
-- politika yalniz aktif veya kendi ilanlarini goruyordu.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'listings' and policyname = 'admins read all listings'
  ) then
    create policy "admins read all listings" on public.listings
      for select using (public.is_admin());
  end if;
end $$;
