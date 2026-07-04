-- =====================================================================
-- Telefon gizliliği DÜZELTME (önceki migration eksik kaldı)
-- =====================================================================
-- Önceki 20260704120000 yalnızca kolon bazlı REVOKE yaptı; ancak profiles'ta
-- tablo-seviyesi GRANT SELECT (tüm kolonlar) hâlâ geçerli olduğu için anon
-- telefonu/preferences'ı okumaya devam ediyordu. PostgreSQL'de bir kolonu
-- gizlemek için önce tablo-seviyesi SELECT geri alınmalı, sonra yalnızca güvenli
-- kolonlara SELECT verilmelidir.
--
-- Sonuç: anon (giriş yapmamış) yalnızca gösterime uygun kolonları görür; phone
-- ve preferences YALNIZCA authenticated/service_role tarafından okunur.
-- =====================================================================

revoke select on public.profiles from anon;

grant select (
  id, full_name, avatar_url, bio,
  verified_phone, verified_identity, verified_instagram,
  rating, response_rate, role, status, created_at, updated_at
) on public.profiles to anon;
