-- Platform ayarlari (tek satir). Admin panelindeki anahtarlar buraya yazilir ve
-- uygulama davranisini etkiler. Herkes okur (bayraklar UI'yi belirler), yalniz admin yazar.

create table if not exists public.platform_settings (
  id int primary key default 1,
  allow_signups boolean not null default true,
  review_before_publish boolean not null default false,
  require_email_verification boolean not null default false,
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id = 1)
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'platform_settings' and policyname = 'anyone reads platform settings') then
    create policy "anyone reads platform settings" on public.platform_settings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'platform_settings' and policyname = 'admins write platform settings') then
    create policy "admins write platform settings" on public.platform_settings for update using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Canli guncelleme icin realtime publication'a ekle (idempotent).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'platform_settings') then
    execute 'alter publication supabase_realtime add table public.platform_settings';
  end if;
end $$;
