-- Admin panelden yönetilen EKSTRA kategoriler. Kod-tabanlı temel ağaca (category-tree.ts)
-- EKLENIR; temel ağacı değiştirmez (create/keşfet akışları korunur). Ekstra kategorinin
-- formKey'i yoktur -> uygulama genel/varsayılan form şemasını kullanır.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  slug text not null default '',
  image text not null default '',
  subcategories jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='categories' and policyname='public read active categories') then
    create policy "public read active categories" on public.categories for select using (is_active or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='categories' and policyname='admins write categories') then
    create policy "admins write categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
