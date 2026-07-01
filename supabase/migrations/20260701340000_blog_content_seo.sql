-- Blog yazilari, duzenlenebilir site icerik sayfalari ve SEO ayarlari.
-- Hepsi: public read (yayindakiler), admin write (RLS is_admin).

-- 1) Blog yazilari
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category text not null default 'Satış İpuçları',
  title text not null,
  excerpt text not null default '',
  author text not null default 'OrtakSat',
  author_role text not null default 'Editör',
  read_min int not null default 3,
  image text not null default '',
  featured boolean not null default false,
  body jsonb not null default '[]'::jsonb,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blog_posts_status_idx on public.blog_posts (status, created_at desc);

-- 2) Duzenlenebilir site icerik sayfalari (Hakkimizda, SSS, vb.)
create table if not exists public.content_pages (
  slug text primary key,
  title text not null default '',
  body text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  updated_at timestamptz not null default now()
);

-- 3) Sayfa bazli SEO ayarlari
create table if not exists public.seo_settings (
  path text primary key,
  meta_title text not null default '',
  meta_description text not null default '',
  og_image text not null default '',
  noindex boolean not null default false,
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.blog_posts enable row level security;
alter table public.content_pages enable row level security;
alter table public.seo_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='blog_posts' and policyname='public read published posts') then
    create policy "public read published posts" on public.blog_posts for select using (status = 'published' or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='blog_posts' and policyname='admins write posts') then
    create policy "admins write posts" on public.blog_posts for all using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where tablename='content_pages' and policyname='public read content') then
    create policy "public read content" on public.content_pages for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='content_pages' and policyname='admins write content') then
    create policy "admins write content" on public.content_pages for all using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where tablename='seo_settings' and policyname='public read seo') then
    create policy "public read seo" on public.seo_settings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='seo_settings' and policyname='admins write seo') then
    create policy "admins write seo" on public.seo_settings for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
