-- Append-only server events. Clients can only read their own history.
create table if not exists public.mobile_partner_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 partnership_id uuid references public.partnerships(id) on delete set null,
 sale_id uuid references public.commissions(id) on delete set null,
 listing_id uuid references public.listings(id) on delete set null,
 kind text not null check(kind in ('application','approved','rejected','cancelled','completed','blocked','paid')),
 title text not null,
 amount numeric,
 currency text,
 created_at timestamptz not null default now()
);
create index if not exists mobile_partner_events_user_time_idx on public.mobile_partner_events(user_id,created_at desc,id);
create index if not exists mobile_partner_events_partnership_idx on public.mobile_partner_events(partnership_id);
create index if not exists mobile_partner_events_sale_idx on public.mobile_partner_events(sale_id);
create index if not exists mobile_partner_events_listing_idx on public.mobile_partner_events(listing_id);
alter table public.mobile_partner_events enable row level security;
revoke all on public.mobile_partner_events from public,anon,authenticated;
grant select on public.mobile_partner_events to authenticated;
drop policy if exists "partner reads own events" on public.mobile_partner_events;
create policy "partner reads own events" on public.mobile_partner_events for select to authenticated using(user_id=(select auth.uid()));

create or replace function private.mobile_record_partner_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare user_id uuid; kind text; title text; currency text;
begin
 if tg_argv[0]='sale' then
  if new.status::text<>'paid' or (tg_op='UPDATE' and old.status::text='paid') then return new;end if;
  select p.partner_id into user_id from public.partnerships p where p.id=new.partnership_id;
  select l.title,coalesce(l.currency,'TRY') into title,currency from public.listings l where l.id=new.listing_id;
  if user_id is not null then insert into public.mobile_partner_events(user_id,partnership_id,sale_id,listing_id,kind,title,amount,currency)
   values(user_id,new.partnership_id,new.id,new.listing_id,'paid',coalesce(title,'Arşivlenmiş ilan'),new.amount,currency);end if;
  return new;
 end if;
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new;end if;
 select l.title,coalesce(l.currency,'TRY') into title,currency from public.listings l where l.id=new.listing_id;
 if tg_op='INSERT' then insert into public.mobile_partner_events(user_id,partnership_id,listing_id,kind,title)
  values(new.partner_id,new.id,new.listing_id,'application',coalesce(title,'Arşivlenmiş ilan'));end if;
 kind:=case new.status::text when 'pending' then 'application' when 'active' then 'approved' else new.status::text end;
 if tg_op='UPDATE' or kind<>'application' then insert into public.mobile_partner_events(user_id,partnership_id,listing_id,kind,title)
  values(new.partner_id,new.id,new.listing_id,kind,coalesce(title,'Arşivlenmiş ilan'));end if;
 return new;
end $$;
revoke all on function private.mobile_record_partner_event() from public,anon,authenticated;
drop trigger if exists mobile_partner_status_history on public.partnerships;
create trigger mobile_partner_status_history after insert or update of status on public.partnerships for each row execute function private.mobile_record_partner_event('partnership');
drop trigger if exists mobile_partner_paid_history on public.commissions;
create trigger mobile_partner_paid_history after insert or update of status on public.commissions for each row execute function private.mobile_record_partner_event('sale');

create or replace function public.mobile_partner_activity(event_kind text default 'all',page_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
with mine as materialized (
 select p.*,l.title from public.partnerships p left join public.listings l on l.id=p.listing_id where p.partner_id=(select auth.uid())
), events as (
 select e.id::text,e.partnership_id,e.listing_id,e.kind,e.title,e.amount,e.currency,e.created_at from public.mobile_partner_events e where e.user_id=(select auth.uid())
 union all
 select 'application:'||p.id,p.id,p.listing_id,'application',coalesce(p.title,'Arşivlenmiş ilan'),null::numeric,null::text,p.created_at from mine p
 where not exists(select 1 from public.mobile_partner_events e where e.partnership_id=p.id and e.kind='application')
 union all
 select 'approved:'||p.id,p.id,p.listing_id,'approved',coalesce(p.title,'Arşivlenmiş ilan'),null::numeric,null::text,p.approved_at from mine p where p.approved_at is not null
 and not exists(select 1 from public.mobile_partner_events e where e.partnership_id=p.id and e.kind='approved')
 union all
 select 'paid:'||c.id,p.id,c.listing_id,'paid',coalesce(p.title,'Arşivlenmiş ilan'),c.amount,l.currency,c.paid_at from public.commissions c join mine p on p.id=c.partnership_id left join public.listings l on l.id=c.listing_id
 where c.status::text='paid' and c.paid_at is not null and c.deleted_at is null and not exists(select 1 from public.mobile_partner_events e where e.sale_id=c.id and e.kind='paid')
), filtered as materialized (select * from events where event_kind='all' or kind=event_kind), page as (
 select * from filtered order by created_at desc,id limit 24 offset least(1000000,greatest(0,coalesce(page_offset,0)))
)
select jsonb_build_object('total',(select count(*) from filtered),'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'partnershipId',partnership_id,'listingId',listing_id,'kind',kind,'title',title,'amount',amount,'currency',currency,'createdAt',created_at) order by created_at desc,id) from page),'[]'::jsonb));
$$;
revoke all on function public.mobile_partner_activity(text,integer) from public,anon;
grant execute on function public.mobile_partner_activity(text,integer) to authenticated;
