-- ORTAKLIKTA ÖZEL NOT: "Ortak Notları — sadece ortak görür" / "Satıcı Notları — sadece satıcı görür".
--
-- Her taraf, bir ortaklık için YALNIZ KENDİSİNİN gördüğü tek bir not tutar (ör. "Müşteri tekrar aranacak, cumartesi
-- görüşeceğim" ya da "Bu ortak güvenilir, daha önce 3 satış yaptı"). Karşı taraf, yöneticiler dahil başka hiç kimse
-- uygulama üzerinden okuyamaz: satır düzeyi güvenlik yalnız yazarına izin verir ve yazar o ortaklığın tarafı olmalıdır.
create table if not exists public.partnership_notes (
  partnership_id uuid not null references public.partnerships (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (partnership_id, author_id)
);

alter table public.partnership_notes enable row level security;

-- Yazar o ortaklığın ortağı ya da ilanın sahibi mi? (Politika içinden çağrılır; tanımlayanın izniyle çalışır ki
-- partnerships / listings üzerindeki satır kuralları bu denetimi bozmasın.)
create or replace function private.is_partnership_party(p_partnership uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.partnerships p
      join public.listings l on l.id = p.listing_id
     where p.id = p_partnership and (p.partner_id = p_user or l.owner_id = p_user)
  );
$$;

revoke all on function private.is_partnership_party(uuid, uuid) from public;
grant execute on function private.is_partnership_party(uuid, uuid) to authenticated;

drop policy if exists "own partnership note read" on public.partnership_notes;
create policy "own partnership note read" on public.partnership_notes
  for select to authenticated using (author_id = auth.uid());

drop policy if exists "own partnership note write" on public.partnership_notes;
create policy "own partnership note write" on public.partnership_notes
  for insert to authenticated
  with check (author_id = auth.uid() and private.is_partnership_party(partnership_id, auth.uid()));

drop policy if exists "own partnership note update" on public.partnership_notes;
create policy "own partnership note update" on public.partnership_notes
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and private.is_partnership_party(partnership_id, auth.uid()));

drop policy if exists "own partnership note delete" on public.partnership_notes;
create policy "own partnership note delete" on public.partnership_notes
  for delete to authenticated using (author_id = auth.uid());

revoke all on public.partnership_notes from anon;
grant select, insert, update, delete on public.partnership_notes to authenticated;
