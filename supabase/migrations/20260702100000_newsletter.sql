-- E-bülten aboneleri: herkes abone olabilir, yalnız admin okur.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "newsletter public insert" on public.newsletter_subscribers;
create policy "newsletter public insert"
  on public.newsletter_subscribers for insert
  with check (true);

drop policy if exists "newsletter admin read" on public.newsletter_subscribers;
create policy "newsletter admin read"
  on public.newsletter_subscribers for select
  using (public.is_admin());
