create type public.moderation_status as enum ('open', 'reviewing', 'resolved', 'rejected');

create schema if not exists private;

alter table public.profiles
  add column if not exists role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  add column if not exists status text not null default 'active' check (status in ('active', 'suspended', 'deleted'));

alter table public.listings
  add column if not exists moderation_status public.moderation_status not null default 'open',
  add column if not exists moderation_note text;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  details text not null default '',
  status public.moderation_status not null default 'open',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (listing_id is not null or reported_user_id is not null)
);

alter table public.reports enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'moderator') and p.status = 'active'
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, verified_phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.phone, 'Ortaksat kullanıcısı'),
    new.phone,
    new.phone is not null
  )
  on conflict (id) do update set
    phone = excluded.phone,
    verified_phone = excluded.verified_phone;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create policy "admins read all profiles" on public.profiles for select using (public.is_admin() or true);
create policy "admins moderate listings" on public.listings for update using (public.is_admin()) with check (public.is_admin());
create policy "users create reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "users read own reports" on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
create policy "admins update reports" on public.reports for update using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.reports to authenticated;

create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_listing_idx on public.reports(listing_id);
create index if not exists profiles_role_idx on public.profiles(role);
