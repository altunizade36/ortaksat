-- Kayıtlı aramalar: cihazlar arası kalıcılık (eskiden yalnız localStorage). RLS owner-only.
create table if not exists public.saved_searches (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  q text not null default '',
  filters jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_saved_searches_user on public.saved_searches(user_id, created_at desc);
alter table public.saved_searches enable row level security;
drop policy if exists ss_owner_all on public.saved_searches;
create policy ss_owner_all on public.saved_searches for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.saved_searches to authenticated;
