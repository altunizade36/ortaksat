create or replace function public.mobile_partner_performance(period_days integer default 30)
returns jsonb language sql stable security invoker set search_path='' as $$
with settings as (
 select least(90,greatest(7,coalesce(period_days,30))) as days,
 (now() at time zone 'Europe/Istanbul')::date as today
), mine as materialized (
 select p.id,p.status from public.partnerships p where p.partner_id=(select auth.uid())
), clicks as materialized (
 select c.created_at from public.referral_clicks c join mine p on p.id=c.partnership_id
), leads as materialized (
 select l.created_at,l.listing_id from public.leads l join mine p on p.id=l.partnership_id
), sales as materialized (
 select c.created_at,c.status from public.commissions c join mine p on p.id=c.partnership_id where c.deleted_at is null
), own as materialized (
 select l.category,l.attributes from public.listings l where l.owner_id=(select auth.uid()) and l.status in ('active','paused','expired','sold')
), series as (
 select d::date as day,(select count(*) from clicks c where (c.created_at at time zone 'Europe/Istanbul')::date=d::date) as value
 from settings s cross join lateral generate_series(s.today-(s.days-1),s.today,interval '1 day') d
), categories as (
 select coalesce(nullif(l.attributes->>'_root',''),l.category,'Arşiv / erişilemeyen ilan') as label,count(*) as value
 from leads r left join public.listings l on l.id=r.listing_id cross join settings s
 where (r.created_at at time zone 'Europe/Istanbul')::date>=s.today-(s.days-1)
 group by 1 order by count(*) desc limit 8
)
select jsonb_build_object(
 'clicks',(select count(*) from clicks c where (c.created_at at time zone 'Europe/Istanbul')::date>=s.today-(s.days-1)),
 'previousClicks',(select count(*) from clicks c where (c.created_at at time zone 'Europe/Istanbul')::date between s.today-(2*s.days-1) and s.today-s.days),
 'leads',(select count(*) from leads l where (l.created_at at time zone 'Europe/Istanbul')::date>=s.today-(s.days-1)),
 'sales',(select count(*) from sales c where c.status in ('approved','seller_paid','paid') and (c.created_at at time zone 'Europe/Istanbul')::date>=s.today-(s.days-1)),
 'active',(select count(*) from mine p where p.status='active'),
 'partnerCount',(select count(*) from mine),
 'listingCount',(select count(*) from own),
 'distinctCategories',(select count(distinct coalesce(nullif(attributes->>'_root',''),category)) from own),
 'completedSales',(select count(*) from sales where status in ('approved','seller_paid','paid')),
 'clickSeries',coalesce((select jsonb_agg(jsonb_build_object('label',day,'value',value) order by day) from series),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',value)) from categories),'[]'::jsonb)
) from settings s;
$$;
revoke all on function public.mobile_partner_performance(integer) from public,anon;
grant execute on function public.mobile_partner_performance(integer) to authenticated;
