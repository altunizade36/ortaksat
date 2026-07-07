create table if not exists public.hidden_categories (
  category_key text primary key,
  created_at timestamptz not null default now()
);
alter table public.hidden_categories enable row level security;
drop policy if exists "hidden cats readable" on public.hidden_categories;
create policy "hidden cats readable" on public.hidden_categories for select using (true);
drop policy if exists "admins manage hidden cats" on public.hidden_categories;
create policy "admins manage hidden cats" on public.hidden_categories for all using (public.is_admin()) with check (public.is_admin());
select 'hidden_categories ready' as status;
