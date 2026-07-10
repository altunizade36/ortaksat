-- Yorumlarda satıcı yanıtı + faydalı oyu (güven/etkileşim). Kolon-seviye RLS yerine
-- SECURITY DEFINER RPC (yalnız yetkili çağıran ilgili alanı değiştirir).
alter table public.reviews add column if not exists seller_reply text;
alter table public.reviews add column if not exists seller_reply_at timestamptz;
alter table public.reviews add column if not exists helpful_count int not null default 0;

-- Satıcı (yorumun HAKKINDA olduğu kişi) yorumuna bir kez yanıt yazar/günceller.
create or replace function public.reply_to_review(p_review_id uuid, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare v_target uuid;
begin
  select reviewed_user_id into v_target from public.reviews where id = p_review_id;
  if v_target is null then raise exception 'review not found'; end if;
  if v_target <> (select auth.uid()) then raise exception 'only the reviewed seller can reply'; end if;
  update public.reviews
    set seller_reply = nullif(btrim(p_reply), ''),
        seller_reply_at = case when nullif(btrim(p_reply), '') is null then null else now() end
    where id = p_review_id;
end $$;
revoke all on function public.reply_to_review(uuid, text) from public;
grant execute on function public.reply_to_review(uuid, text) to authenticated;

-- "Faydalı" oyu: kullanıcı başına bir kez (unique), tekrar basınca geri alır (toggle).
create table if not exists public.review_helpful_votes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table public.review_helpful_votes enable row level security;
drop policy if exists rhv_own on public.review_helpful_votes;
create policy rhv_own on public.review_helpful_votes for select using (user_id = (select auth.uid()));

create or replace function public.toggle_review_helpful(p_review_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_uid uuid := (select auth.uid()); v_exists boolean; v_count int;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select exists(select 1 from public.review_helpful_votes where review_id = p_review_id and user_id = v_uid) into v_exists;
  if v_exists then
    delete from public.review_helpful_votes where review_id = p_review_id and user_id = v_uid;
  else
    insert into public.review_helpful_votes(review_id, user_id) values (p_review_id, v_uid) on conflict do nothing;
  end if;
  select count(*) into v_count from public.review_helpful_votes where review_id = p_review_id;
  update public.reviews set helpful_count = v_count where id = p_review_id;
  return v_count;
end $$;
revoke all on function public.toggle_review_helpful(uuid) from public;
grant execute on function public.toggle_review_helpful(uuid) to authenticated;

-- anon feed'e kolon eklenmiyor (reviews public SELECT policy zaten '*'); yine de yeni kolonların
-- anon/auth SELECT'i için grant (güvenli — yorum içeriği zaten herkese açık).
grant select (seller_reply, seller_reply_at, helpful_count) on public.reviews to anon, authenticated;
