create or replace function public.admin_timeseries(p_days integer default 30)
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
 set "TimeZone" to 'Europe/Istanbul'
as $function$
declare is_admin boolean; result json; n integer := least(greatest(coalesce(p_days, 30), 7), 365);
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into is_admin from public.profiles where id = auth.uid();
  if not coalesce(is_admin, false) then raise exception 'not authorized'; end if;
  select json_build_object(
    'range', n,
    'days', (
      select json_agg(json_build_object(
        'day', s.day, 'active', coalesce(ac.n,0), 'signups', coalesce(su.n,0), 'listings', coalesce(li.n,0),
        'messages', coalesce(ms.n,0), 'leads', coalesce(ld.n,0), 'orders', coalesce(og.n,0),
        'gmv', coalesce(og.amt,0), 'commission', coalesce(cg.amt,0)
      ) order by s.day)
      from (select (current_date - (n - 1) + i)::date as day from generate_series(0, n - 1) i) s
      left join (select created_at::date d, count(*) n from auth.users where created_at >= current_date - (n - 1) group by 1) su on su.d = s.day
      left join (select created_at::date d, count(*) n from public.listings where created_at >= current_date - (n - 1) group by 1) li on li.d = s.day
      left join (select day, count(*) n from public.user_active_days where day >= current_date - (n - 1) group by day) ac on ac.day = s.day
      left join (select created_at::date d, count(*) n from public.messages where created_at >= current_date - (n - 1) group by 1) ms on ms.d = s.day
      left join (select created_at::date d, count(*) n from public.leads where created_at >= current_date - (n - 1) group by 1) ld on ld.d = s.day
      left join (select created_at::date d, count(*) n, coalesce(sum(amount),0) amt from public.orders where created_at >= current_date - (n - 1) group by 1) og on og.d = s.day
      left join (select created_at::date d, coalesce(sum(amount),0) amt from public.commissions where deleted_at is null and created_at >= current_date - (n - 1) group by 1) cg on cg.d = s.day
    ),
    'messages_24h', (select count(*) from public.messages where created_at >= now() - interval '24 hours'),
    'messages_prev_24h', (select count(*) from public.messages where created_at >= now() - interval '48 hours' and created_at < now() - interval '24 hours'),
    'leads_7d', (select count(*) from public.leads where created_at >= now() - interval '7 days'),
    'leads_prev_7d', (select count(*) from public.leads where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
    'orders_7d', (select count(*) from public.orders where created_at >= now() - interval '7 days'),
    'orders_prev_7d', (select count(*) from public.orders where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
    'reports_7d', (select count(*) from public.reports where created_at >= now() - interval '7 days'),
    'reports_prev_7d', (select count(*) from public.reports where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
    'views_total', (select coalesce(sum(view_count),0) from public.listing_public_stats),
    'leads_total', (select count(*) from public.leads),
    'root_categories', (
      select json_agg(json_build_object('root', r, 'n', c) order by c desc)
      from (select coalesce(nullif(attributes ->> '_root',''), 'Diğer') r, count(*) c from public.listings where status = 'active' and deleted_at is null group by 1) t
    ),
    'top_sellers', (
      select json_agg(json_build_object('name', coalesce(nullif(pr.full_name,''),'Satıcı'), 'n', t.c) order by t.c desc)
      from (select owner_id, count(*) c from public.listings where status = 'active' and deleted_at is null group by owner_id order by count(*) desc limit 8) t
      left join public.profiles pr on pr.id = t.owner_id
    )
  ) into result;
  return result;
end;
$function$;
revoke execute on function public.admin_timeseries(integer) from public, anon;
grant execute on function public.admin_timeseries(integer) to authenticated;
