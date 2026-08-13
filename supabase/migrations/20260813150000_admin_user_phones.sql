-- Admin geliştirme (2026-08-13): admin'e kullanıcı telefonlarını GERİ ver (is_admin-korumalı).
-- 20260813130000 phone toplu-SELECT grant'ını kaldırdı → admin panel loadAdminSnapshot artık
-- phone'suz yüklüyor → admin CSV dışa-aktarımının "Telefon" sütunu + kullanıcı detayı BOŞTU.
-- Admin destek/kayıt için gerçek telefonu görmeli. Çözüm: yalnız is_admin() geçen çağırana
-- id→phone döndüren SECURITY DEFINER RPC (normal kullanıcı çağırırsa BOŞ döner).

create or replace function public.admin_user_phones()
returns table(id uuid, phone text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.phone
  from public.profiles p
  where public.is_admin();  -- admin değilse hiç satır dönmez (toplu telefon yalnız yöneticiye)
$$;

comment on function public.admin_user_phones() is
  'Yalnız admin/moderatöre (is_admin) tüm kullanıcıların id+telefonunu döner (admin panel CSV + detay). Normal kullanıcıya boş.';

revoke execute on function public.admin_user_phones() from public, anon;
grant execute on function public.admin_user_phones() to authenticated;
