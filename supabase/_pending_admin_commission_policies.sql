-- Yönetim, komisyon anlaşmazlıklarını görebilsin ve çözebilsin (2026-11-12).
-- guard_commission_paid tetikleyicisi personel (admin/moderatör) için zaten istisna tanıyordu, ama
-- RLS'te personel için SELECT/UPDATE policy'si YOKTU: panelde yalnız yöneticinin kendi komisyonları
-- listeleniyor, "Çöz · Onayla" / "İptal" ise 0 satır güncelleyip başarı bildiriyordu.
begin;
drop policy if exists "admins read commissions" on public.commissions;
create policy "admins read commissions" on public.commissions for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "admins update commissions" on public.commissions;
create policy "admins update commissions" on public.commissions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
commit;
