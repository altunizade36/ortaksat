alter table public.profiles
  add column if not exists verified_instagram boolean not null default false;

comment on column public.profiles.verified_instagram is
  'Instagram account verification flag used by Ortaksat trust scoring. Only admins/system flows should set this.';

create or replace function private.prevent_profile_trust_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.verified_identity is distinct from old.verified_identity then
    raise exception 'Only admins can update identity verification';
  end if;

  if new.verified_instagram is distinct from old.verified_instagram then
    raise exception 'Only admins can update Instagram verification';
  end if;

  if new.rating is distinct from old.rating or new.response_rate is distinct from old.response_rate then
    raise exception 'Only system or admins can update profile trust metrics';
  end if;

  if new.phone is distinct from old.phone then
    new.verified_phone = false;
  elsif new.verified_phone is distinct from old.verified_phone then
    raise exception 'Phone verification cannot be edited directly';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_trust_escalation on public.profiles;
create trigger prevent_profile_trust_escalation
  before update on public.profiles
  for each row execute function private.prevent_profile_trust_escalation();
