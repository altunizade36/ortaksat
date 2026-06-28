alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

create or replace function private.touch_profile_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profile_updated_at on public.profiles;
create trigger touch_profile_updated_at
  before update on public.profiles
  for each row execute function private.touch_profile_updated_at();

create index if not exists profiles_updated_at_idx on public.profiles(updated_at desc);

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public profile avatars readable" on storage.objects for select using (bucket_id = 'profile-avatars');
create policy "users upload own profile avatars" on storage.objects for insert with check (
  bucket_id = 'profile-avatars' and auth.role() = 'authenticated' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "users update own profile avatars" on storage.objects for update using (
  bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]
) with check (
  bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "users delete own profile avatars" on storage.objects for delete using (
  bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
