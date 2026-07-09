-- Mağaza takibi (Trendyol/Sahibinden "Takip Et"). Retention + sosyal-kanıt kaldıracı.
-- follows: kim kimi takip ediyor. follower_count profiles'a trigger ile denormalize edilir
-- (successful_sales desenindeki gibi). Anon takipçi sayısını görebilmeli (sosyal kanıt) →
-- follower_count kolonuna anon SELECT grant ŞART (anon-kolon-grant tuzağı; yoksa 401).
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, seller_id)
);
alter table public.follows enable row level security;

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select using (true);
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert with check (auth.uid() = follower_id and follower_id <> seller_id);
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete using (auth.uid() = follower_id);

grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
create index if not exists idx_follows_follower on public.follows(follower_id);
create index if not exists idx_follows_seller on public.follows(seller_id);

alter table public.profiles add column if not exists follower_count integer not null default 0;
grant select (follower_count) on public.profiles to anon, authenticated;

-- Geriye dönük doldur (mevcut takipler varsa).
update public.profiles p set follower_count = coalesce(sub.c, 0)
from (select seller_id, count(*)::int c from public.follows group by seller_id) sub
where p.id = sub.seller_id;

create or replace function public.bump_follower_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update profiles set follower_count = follower_count + 1 where id = new.seller_id;
  elsif tg_op = 'DELETE' then
    update profiles set follower_count = greatest(0, follower_count - 1) where id = old.seller_id;
  end if;
  return null;
end; $$;
drop trigger if exists trg_bump_follower_count on public.follows;
create trigger trg_bump_follower_count after insert or delete on public.follows
  for each row execute function public.bump_follower_count();
