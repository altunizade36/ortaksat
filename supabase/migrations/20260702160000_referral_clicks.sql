-- Referans linki tıklama takibi: ortak linki (/i/slug?ref=kod) açıldığında kaydedilir.
-- Böylece ortak, kaç kişinin linke tıkladığını ve dönüşüm oranını görebilir.
create table if not exists public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade,
  partnership_id uuid,
  ref_code text,
  created_at timestamptz not null default now()
);

create index if not exists referral_clicks_partnership_idx on public.referral_clicks (partnership_id);

alter table public.referral_clicks enable row level security;

-- Tıklama herkese açık kaydedilir (giriş gerekmez; link ziyaretçisi anonim olabilir).
drop policy if exists "rc public insert" on public.referral_clicks;
create policy "rc public insert" on public.referral_clicks for insert with check (true);

-- Sayımlar herkese açık okunur (hassas veri değil, yalnız sayaç).
drop policy if exists "rc public read" on public.referral_clicks;
create policy "rc public read" on public.referral_clicks for select using (true);
