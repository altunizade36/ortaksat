-- Genişletilmiş canlı analitik: kullanıcı + site-geneli SUNUCU-GERÇEK toplamlar (istemci cap'i yok)
-- + 14-gün trend (kayıt/aktif/ilan) + top kategoriler + moderasyon kuyruğu.
create or replace function public.admin_live_analytics()
returns json language plpgsql security definer set search_path to 'public','auth' as $$
declare is_admin boolean; result json;
begin
  select (role in ('admin','super_admin','moderator')) into is_admin from public.profiles where id = auth.uid();
  if not coalesce(is_admin, false) then raise exception 'not authorized'; end if;
  select json_build_object(
    'total_users', (select count(*) from auth.users),
    'confirmed_users', (select count(*) from auth.users where email_confirmed_at is not null),
    'live_now', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
    'active_today', (select count(*) from public.user_active_days where day = current_date),
    'new_today', (select count(*) from auth.users where created_at >= date_trunc('day', now())),
    'new_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'listings_total', (select count(*) from public.listings),
    'listings_active', (select count(*) from public.listings where status='active'),
    'listings_pending', (select count(*) from public.listings where status='pending_review'),
    'listings_paused', (select count(*) from public.listings where status='paused'),
    'listings_sold', (select count(*) from public.listings where status='sold'),
    'listings_new_7d', (select count(*) from public.listings where created_at >= now() - interval '7 days'),
    'commissions_total', (select count(*) from public.commissions),
    'commissions_paid', (select count(*) from public.commissions where status='paid'),
    'gmv', (select coalesce(sum(amount),0) from public.commissions),
    'paid_gmv', (select coalesce(sum(amount) filter (where status='paid'),0) from public.commissions),
    'partnerships_total', (select count(*) from public.partnerships),
    'partnerships_active', (select count(*) from public.partnerships where status='active'),
    'partnerships_pending', (select count(*) from public.partnerships where status='pending'),
    'orders_total', (select count(*) from public.orders),
    'open_reports', (select count(*) from public.reports where status in ('open','reviewing')),
    'cat_suggestions', (select count(*) from public.category_suggestions where status='pending'),
    'loc_suggestions', (select count(*) from public.location_suggestions where status='pending'),
    'days', (select json_agg(row_to_json(d) order by d.day) from (
        select gs::date as day,
          (select count(*) from public.user_active_days uad where uad.day = gs::date) as active,
          (select count(*) from auth.users u where u.created_at::date = gs::date) as signups,
          (select count(*) from public.listings l where l.created_at::date = gs::date) as listings
        from generate_series(current_date - 13, current_date, interval '1 day') gs
      ) d),
    'top_categories', (select json_agg(row_to_json(c)) from (
        select category, count(*) as n from public.listings where status='active' group by category order by count(*) desc limit 8
      ) c)
  ) into result;
  return result;
end; $$;
