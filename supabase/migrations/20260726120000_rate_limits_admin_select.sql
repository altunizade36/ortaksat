-- Admin paneli dashboard'u son rate-limit sayısını okumak için public.rate_limits'i
-- sorguluyordu; ama tabloda RLS AÇIK olmasına rağmen HİÇBİR policy + authenticated GRANT
-- yoktu → her admin yüklemesinde "42501 permission denied for table rate_limits" (403).
-- Çözüm: authenticated'e SELECT grant + yalnız aktif admin/moderatör okuyabilsin (is_admin()).
-- is_admin() SECURITY DEFINER'dır → profiles'ı çağıranın izniyle değil kendi izniyle okur
-- (RLS alt-sorgu tuzağına düşmez).

grant select on public.rate_limits to authenticated;

drop policy if exists rate_limits_admin_read on public.rate_limits;
create policy rate_limits_admin_read on public.rate_limits
  for select to authenticated
  using (public.is_admin());
