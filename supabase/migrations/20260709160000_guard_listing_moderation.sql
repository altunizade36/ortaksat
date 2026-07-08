-- Moderasyon kaçağını sunucu tarafında engelle: ilan sahibi, incelemedeki
-- (pending_review) veya reddedilmiş (rejected) bir ilanı kendisi "active" yapamaz.
-- Yalnızca admin/moderatör (is_admin) yayına alabilir. service_role (auth.uid NULL)
-- ve admin muaftır; normal aktif/pasif geçişleri etkilenmez.
create or replace function guard_listing_moderation() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- service_role / sunucu
  if is_admin() then return new; end if;         -- admin/moderatör yayına alabilir
  if old.status in ('pending_review', 'rejected') and new.status = 'active' then
    raise exception 'Bu ilan incelemede; yayina almak icin admin onayi gerekir';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_listing_moderation on listings;
create trigger trg_guard_listing_moderation before update on listings
  for each row execute function guard_listing_moderation();
