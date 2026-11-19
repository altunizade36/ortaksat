-- my_listing_quota: kategori başına sınırı ve dolu kategorileri de döndürür (2026-11-19).
-- İlan ver ekranı, kullanıcı formu doldurmadan önce "bu kategoride zaten ilanınız var" uyarısını gösterir.
-- Sınırı olmayan hesapta limit/per_category null, full_categories boş.
create or replace function public.my_listing_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int;
  v_cat int;
  v_used int;
  v_full jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  v_limit := private.listing_open_limit(v_uid);
  if v_limit is not null then
    select max_per_category into v_cat from public.listing_quota_overrides where user_id = v_uid;
  end if;
  select count(*) into v_used from public.listings
    where owner_id = v_uid and status::text in ('active','pending_review','paused','draft');
  if v_cat is not null then
    select coalesce(jsonb_agg(category), '[]'::jsonb) into v_full from (
      select category from public.listings
      where owner_id = v_uid and status::text in ('active','pending_review','paused','draft') and category is not null
      group by category having count(*) >= v_cat
    ) s;
  end if;
  return jsonb_build_object(
    'used', v_used,
    'limit', v_limit,
    'remaining', case when v_limit is null then null else greatest(v_limit - v_used, 0) end,
    'per_category', v_cat,
    'full_categories', v_full
  );
end;
$$;
revoke all on function public.my_listing_quota() from public, anon;
grant execute on function public.my_listing_quota() to authenticated;
