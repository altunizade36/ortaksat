-- İlan Soru-Cevap: alıcılar herkese açık soru sorar, ilan sahibi cevaplar.
create table if not exists public.listing_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  asker_id uuid references public.profiles(id) on delete set null,
  asker_name text,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists listing_questions_listing_idx on public.listing_questions (listing_id, created_at desc);

alter table public.listing_questions enable row level security;

drop policy if exists "lq public read" on public.listing_questions;
create policy "lq public read" on public.listing_questions for select using (true);

drop policy if exists "lq ask authenticated" on public.listing_questions;
create policy "lq ask authenticated" on public.listing_questions
  for insert with check (auth.role() = 'authenticated' and asker_id = auth.uid());

drop policy if exists "lq owner answers" on public.listing_questions;
create policy "lq owner answers" on public.listing_questions
  for update using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));
