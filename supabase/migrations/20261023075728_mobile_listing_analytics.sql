-- Owners can aggregate their daily views without reading viewer identifiers.
grant select (listing_id, viewed_on) on public.listing_views to authenticated;
drop policy if exists "mobile owner reads daily views" on public.listing_views;
create policy "mobile owner reads daily views" on public.listing_views for select to authenticated
using (exists(select 1 from public.listings l where l.id=listing_views.listing_id and l.owner_id=(select auth.uid())));

create or replace function public.mobile_seller_categories(seller_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('label',category,'value',n) order by n desc,category),'[]'::jsonb)
from (select category,count(*) n from public.listings where owner_id=seller_id and status='active' and deleted_at is null group by category) c;
$$;
revoke all on function public.mobile_seller_categories(uuid) from public;
grant execute on function public.mobile_seller_categories(uuid) to anon,authenticated;

create or replace function public.mobile_listing_analytics(target_id uuid,period_days integer default 30)
returns jsonb language sql stable security invoker set search_path='' as $$
with owned as materialized (
 select id from public.listings where id=target_id and owner_id=(select auth.uid()) and deleted_at is null
), settings as (
 select least(90,greatest(7,coalesce(period_days,30))) days,(now() at time zone 'Europe/Istanbul')::date today
), views as materialized (
 select v.viewed_on from public.listing_views v join owned o on o.id=v.listing_id
), clicks as materialized (
 select c.channel,c.created_at from public.referral_clicks c join owned o on o.id=c.listing_id
), current_views as (
 select viewed_on from views cross join settings s where viewed_on between s.today-(s.days-1) and s.today
), series as (
 select d::date as day,(select count(*) from current_views v where v.viewed_on=d::date) value
 from settings s cross join lateral generate_series(s.today-(s.days-1),s.today,interval '1 day') d
), sources as (
 select coalesce(nullif(c.channel,''),'Belirtilmedi') label,count(*) value from clicks c cross join settings s
 where (c.created_at at time zone 'Europe/Istanbul')::date between s.today-(s.days-1) and s.today group by 1 order by count(*) desc limit 12
)
select jsonb_build_object(
 'views',coalesce((select s.view_count from public.listing_public_stats s where s.listing_id=o.id),0),
 'favorites',coalesce((select s.favorite_count from public.listing_public_stats s where s.listing_id=o.id),0),
 'partners',(select count(*) from public.partnerships p where p.listing_id=o.id and p.status='active'),
 'requests',(select count(*) from public.partnerships p where p.listing_id=o.id),
 'conversations',(select count(*) from public.conversations c where c.listing_id=o.id),
 'leads',(select count(*) from public.leads l where l.listing_id=o.id),
 'sales',(select count(*) from public.commissions c where c.listing_id=o.id and c.deleted_at is null and c.status in ('approved','seller_paid','paid')),
 'periodViews',(select count(*) from current_views),
 'previousViews',(select count(*) from views cross join settings s where viewed_on between s.today-(2*s.days-1) and s.today-s.days),
 'series',coalesce((select jsonb_agg(jsonb_build_object('label',day,'value',value) order by day) from series),'[]'::jsonb),
 'referralSources',coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',value)) from sources),'[]'::jsonb)
) from owned o;
$$;
revoke all on function public.mobile_listing_analytics(uuid,integer) from public,anon;
grant execute on function public.mobile_listing_analytics(uuid,integer) to authenticated;
