-- İlan sınırı yalnız hedeflenen hesaplara (2026-11-19).
--
-- 20261119090000 herkese 10 açık ilan sınırı koymuştu. Karar değişti: varsayılan SINIRSIZ;
-- sınır yalnız yöneticinin listing_quota_overrides tablosuna eklediği hesaplara uygulanır
-- (aynı işi farklı başlıklarla tekrar tekrar veren hesaplar).
--
-- Sınırlı hesaba uygulanan kurallar:
--   1) en fazla max_open açık ilan (active / pending_review / paused / draft),
--   2) aynı kategoride en fazla max_per_category açık ilan (null = kategori kuralı yok),
--   3) aynı başlığı tekrar veremez.
-- Sınırsız hesaplara hiçbir kural uygulanmaz.

alter table public.listing_quota_overrides
  add column if not exists max_per_category int check (max_per_category is null or max_per_category between 0 and 100000);

create or replace function private.listing_open_limit(p_owner uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when exists (select 1 from public.profiles where id = p_owner and role in ('moderator','admin','super_admin')) then null
    else (select max_open from public.listing_quota_overrides where user_id = p_owner)
  end;
$$;

create or replace function private.enforce_listing_open_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_limit int;
  v_cat_limit int;
  v_used int;
  v_cat_used int;
  v_open constant text[] := array['active','pending_review','paused','draft'];
  v_entering boolean;
  v_cat_changed boolean;
begin
  if new.owner_id is null or not (new.status::text = any(v_open)) then
    return new;
  end if;
  if auth.uid() is not null and public.is_admin() then
    return new;
  end if;

  v_limit := private.listing_open_limit(new.owner_id);
  if v_limit is null then
    return new; -- sınırsız hesap
  end if;
  select max_per_category into v_cat_limit from public.listing_quota_overrides where user_id = new.owner_id;

  -- Hak kullanan duruma yeni giriş mi (ekleme ya da satıldı/süresi doldu → yayında)?
  v_entering := tg_op = 'INSERT' or not (old.status::text = any(v_open));
  -- Açık ilanın kategorisi değiştirildi mi (sınırı kategori değiştirerek atlatmamak için)?
  v_cat_changed := tg_op = 'UPDATE' and new.category is distinct from old.category;
  if not v_entering and not v_cat_changed then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('listing_open_limit:' || new.owner_id::text));

  if v_entering and exists (
    select 1 from public.listings
    where owner_id = new.owner_id
      and id <> new.id
      and status::text = any(v_open)
      and private.normalize_listing_title(title) = private.normalize_listing_title(new.title)
  ) then
    raise exception 'Bu ilan zaten yayında. Aynı ilanı tekrar veremezsiniz; mevcut ilanınızı düzenleyebilirsiniz.'
      using errcode = 'P0001', hint = 'duplicate_listing';
  end if;

  if v_entering then
    select count(*) into v_used from public.listings
      where owner_id = new.owner_id and id <> new.id and status::text = any(v_open);
    if v_used >= v_limit then
      raise exception 'İlan sınırına ulaştınız (% / %). Yeni ilan vermek için yayındaki ilanlarınızdan birini kaldırın ya da Satıldı olarak işaretleyin.', v_used, v_limit
        using errcode = 'P0001', hint = 'listing_limit';
    end if;
  end if;
  if v_cat_limit is not null then
    select count(*) into v_cat_used from public.listings
      where owner_id = new.owner_id and id <> new.id and status::text = any(v_open)
        and category is not distinct from new.category;
    if v_cat_used >= v_cat_limit then
      raise exception 'Bu kategoride zaten ilanınız var. Aynı kategoride yeni ilan veremezsiniz; mevcut ilanınızı düzenleyebilirsiniz.'
        using errcode = 'P0001', hint = 'category_limit';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_listing_open_limit on public.listings;
create trigger trg_listing_open_limit
  before insert or update of status, category on public.listings
  for each row execute function private.enforce_listing_open_limit();

-- p_max null → sınır kaldırılır (hesap sınırsız olur).
create or replace function public.admin_set_listing_limit(p_user uuid, p_max int, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  if p_max is null then
    delete from public.listing_quota_overrides where user_id = p_user;
  else
    insert into public.listing_quota_overrides (user_id, max_open, max_per_category, note, granted_by, updated_at)
    values (p_user, p_max, 1, nullif(trim(coalesce(p_note, '')), ''), auth.uid(), now())
    on conflict (user_id) do update
      set max_open = excluded.max_open, note = excluded.note, granted_by = excluded.granted_by, updated_at = now();
  end if;
end;
$$;

revoke all on function private.listing_open_limit(uuid) from public, anon, authenticated;
revoke all on function private.enforce_listing_open_limit() from public, anon, authenticated;

-- Aynı küptaş ilanını farklı başlıklarla 5 kategoriye 10 kez veren hesap.
insert into public.listing_quota_overrides (user_id, max_open, max_per_category, note, updated_at)
values ('5e576936-7eed-4f68-a91c-67078b9e1ce4', 10, 1, 'Aynı ilanı tekrar tekrar veriyordu (2026-11-19)', now())
on conflict (user_id) do update set max_open = 10, max_per_category = 1, note = excluded.note, updated_at = now();
