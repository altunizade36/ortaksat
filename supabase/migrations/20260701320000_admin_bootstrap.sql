-- Ilk admin bootstrap'i: sistemde HIC aktif admin yokken rol/durum yukseltmesine
-- izin ver (self-healing). Bir admin olustuktan sonra kural yine katidir. Bu,
-- yumurta-tavuk sorununu kalici cozer (RLS 'admins update any profile' + bu trigger).

create or replace function private.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin()
     and (new.role is distinct from old.role or new.status is distinct from old.status)
     and exists (select 1 from public.profiles where role in ('admin', 'super_admin') and status = 'active')
  then
    raise exception 'Only admins can update profile role or status';
  end if;
  return new;
end;
$function$;

-- Ilk admini ata (artik hic admin olmadigi icin trigger izin verir).
update public.profiles set role = 'admin', status = 'active'
where id = (select id from auth.users where lower(email) = lower('m.36fatih36@gmail.com'));
