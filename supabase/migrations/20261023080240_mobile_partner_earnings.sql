create or replace function public.mobile_partner_earnings(target_currency text default 'TRY',page_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
with mine as materialized (
 select p.id,p.listing_id from public.partnerships p where p.partner_id=(select auth.uid())
), sales as materialized (
 select c.id,c.listing_id,c.status,c.amount,c.created_at,c.paid_at,l.title
 from public.commissions c join mine p on p.id=c.partnership_id join public.listings l on l.id=c.listing_id
 where c.deleted_at is null and coalesce(l.currency,'TRY')=target_currency
), months as (
 select d::date as month from generate_series(date_trunc('month',now() at time zone 'Europe/Istanbul')-interval '5 months',date_trunc('month',now() at time zone 'Europe/Istanbul'),interval '1 month') d
), recent as (
 select * from sales order by created_at desc,id limit 24 offset least(1000000,greatest(0,coalesce(page_offset,0)))
)
select jsonb_build_object(
 'paidTotal',coalesce((select sum(amount) from sales where status='paid'),0),
 'paidCount',(select count(*) from sales where status='paid'),
 'approvedTotal',coalesce((select sum(amount) from sales where status in ('approved','seller_paid')),0),
 'leadCount',(select count(*) from public.leads x join mine p on p.id=x.partnership_id join public.listings l on l.id=x.listing_id where coalesce(l.currency,'TRY')=target_currency),
 'total',(select count(*) from sales),
 'series',(select jsonb_agg(jsonb_build_object('label',month,'value',coalesce((select sum(s.amount) from sales s where s.status='paid' and date_trunc('month',coalesce(s.paid_at,s.created_at) at time zone 'Europe/Istanbul')=m.month),0)) order by month) from months m),
 'sales',coalesce((select jsonb_agg(jsonb_build_object('id',id,'listingId',listing_id,'title',title,'status',status,'commissionAmount',amount,'createdAt',created_at,'paidAt',paid_at) order by created_at desc,id) from recent),'[]'::jsonb)
);
$$;
revoke all on function public.mobile_partner_earnings(text,integer) from public,anon;
grant execute on function public.mobile_partner_earnings(text,integer) to authenticated;

