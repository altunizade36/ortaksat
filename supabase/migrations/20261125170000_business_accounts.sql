-- KURUMSAL HESAP: işletme adına açılan hesabın beyan bilgileri.
-- Yalnız hesap sahibi ve yönetici görür; herkese açık hiçbir akışa girmez. Vergi/TC kimlik numarası BİLEREK
-- toplanmaz (platform fatura kesmez, para tutmaz → veri küçültme). Mağaza adı profil adıdır (profiles.full_name).
create table if not exists public.business_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) between 2 and 120),
  business_type text not null check (business_type in ('sahis', 'sirket')),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
  city text check (city is null or char_length(city) <= 60),
  activity text check (activity is null or char_length(activity) <= 80),
  phone text check (phone is null or char_length(phone) <= 24),
  contract_version text not null check (char_length(contract_version) <= 40),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.business_accounts enable row level security;
revoke all on public.business_accounts from anon, authenticated;
grant select, insert, update on public.business_accounts to authenticated;

drop policy if exists "own business account read" on public.business_accounts;
drop policy if exists "own business account insert" on public.business_accounts;
drop policy if exists "own business account update" on public.business_accounts;
create policy "own business account read" on public.business_accounts for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "own business account insert" on public.business_accounts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own business account update" on public.business_accounts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Hesap silinirken (30 günlük askı bitince profil 'deleted' olur) işletme kaydı da silinir; profil kapağı da
-- temizlenir (anonimleştirme kapağı boşaltmıyordu).
create or replace function private.cleanup_deleted_profile() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status::text = 'deleted' and old.status::text is distinct from 'deleted' then
    delete from public.business_accounts where user_id = new.id;
    new.cover_url := null;
  end if;
  return new;
end $$;
revoke execute on function private.cleanup_deleted_profile() from public, anon, authenticated;
drop trigger if exists profiles_cleanup_deleted on public.profiles;
create trigger profiles_cleanup_deleted before update of status on public.profiles
  for each row execute function private.cleanup_deleted_profile();
