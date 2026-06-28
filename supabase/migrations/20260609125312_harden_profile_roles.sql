create or replace function private.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'Only admins can update profile role or status';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
  before update on public.profiles
  for each row execute function private.prevent_profile_role_escalation();
