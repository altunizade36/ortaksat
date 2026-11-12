-- Buyer requests and seller responses. No simulated matches or public contact data.
create table if not exists public.buyer_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 5 and 100),
 description text not null check (char_length(btrim(description)) between 20 and 5000),
 category_trail text[] not null check (cardinality(category_trail) between 1 and 8),
 budget_min numeric not null check (budget_min >= 0),
 budget_max numeric not null check (budget_max > 0 and budget_max >= budget_min),
 currency text not null default 'TRY' check (currency in ('TRY','USD','EUR')),
 province_id integer,
 district_id integer,
 allow_partners boolean not null default true,
 status text not null default 'active' check(status in ('active','closed')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists buyer_requests_active_created_idx on public.buyer_requests(created_at desc) where status='active';
create index if not exists buyer_requests_owner_idx on public.buyer_requests(user_id,created_at desc);
alter table public.buyer_requests enable row level security;
revoke all on public.buyer_requests from anon, authenticated;
grant select on public.buyer_requests to anon,authenticated;
grant insert,update,delete on public.buyer_requests to authenticated;
create policy "visible buyer requests" on public.buyer_requests for select to anon,authenticated
 using (user_id=(select auth.uid()) or (status='active' and expires_at>now() and ((select auth.uid()) is null or not public.is_blocked((select auth.uid()),user_id))));
create policy "create own buyer requests" on public.buyer_requests for insert to authenticated with check (user_id=(select auth.uid()));
create policy "update own buyer requests" on public.buyer_requests for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "delete own buyer requests" on public.buyer_requests for delete to authenticated using(user_id=(select auth.uid()));

create or replace function private.validate_mobile_buyer_request() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
   new.created_at:=now();
 elsif new.user_id<>old.user_id or new.created_at<>old.created_at or new.id<>old.id then
   raise exception 'Request identity cannot be changed' using errcode='22023';
 end if;
 if tg_op='INSERT' or new.expires_at is distinct from old.expires_at then
   if new.expires_at<=now() or new.expires_at>now()+interval '90 days' then raise exception 'Invalid request expiry' using errcode='22023'; end if;
 end if;
 if exists(select 1 from unnest(new.category_trail) label where label is null or char_length(btrim(label)) not between 1 and 120) then raise exception 'Invalid category' using errcode='22023'; end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function private.validate_mobile_buyer_request() from public,anon,authenticated;
create trigger validate_mobile_buyer_request before insert or update on public.buyer_requests for each row execute function private.validate_mobile_buyer_request();

create table if not exists public.buyer_request_offers (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.buyer_requests(id) on delete cascade,
 seller_id uuid not null references public.profiles(id) on delete cascade,
 listing_id uuid not null references public.listings(id) on delete cascade,
 note text not null check(char_length(btrim(note)) between 10 and 1000),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(),
 unique(request_id,listing_id)
);
create index if not exists buyer_request_offers_request_idx on public.buyer_request_offers(request_id,created_at desc);
create index if not exists buyer_request_offers_seller_idx on public.buyer_request_offers(seller_id,created_at desc);
alter table public.buyer_request_offers enable row level security;
revoke all on public.buyer_request_offers from public,anon,authenticated;
grant select,insert,update,delete on public.buyer_request_offers to authenticated;
create policy "participants read request offers" on public.buyer_request_offers for select to authenticated
 using(seller_id=(select auth.uid()) or exists(select 1 from public.buyer_requests r where r.id=request_id and r.user_id=(select auth.uid())));
create policy "sellers respond with own listing" on public.buyer_request_offers for insert to authenticated with check(
 seller_id=(select auth.uid()) and status='pending'
 and exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=(select auth.uid()) and l.status='active')
 and exists(select 1 from public.buyer_requests r where r.id=request_id and r.user_id<>(select auth.uid()) and r.status='active' and r.expires_at>now() and not public.is_blocked(r.user_id,(select auth.uid())))
 );
create policy "buyers decide request offers" on public.buyer_request_offers for update to authenticated
 using(exists(select 1 from public.buyer_requests r where r.id=request_id and r.user_id=(select auth.uid())))
 with check(exists(select 1 from public.buyer_requests r where r.id=request_id and r.user_id=(select auth.uid())));
create policy "sellers remove pending offer" on public.buyer_request_offers for delete to authenticated using(seller_id=(select auth.uid()) and status='pending');
create or replace function private.validate_mobile_buyer_offer() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.created_at:=now();
 elsif new.id<>old.id or new.request_id<>old.request_id or new.seller_id<>old.seller_id or new.listing_id<>old.listing_id or new.note<>old.note or new.created_at<>old.created_at then
   raise exception 'Offer identity and content cannot be changed' using errcode='22023';
 elsif old.status<>'pending' or new.status not in ('accepted','rejected') then raise exception 'Offer already decided' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function private.validate_mobile_buyer_offer() from public,anon,authenticated;
create trigger validate_mobile_buyer_offer before insert or update on public.buyer_request_offers for each row execute function private.validate_mobile_buyer_offer();

create or replace function public.mobile_catalogue_page(params jsonb default '{}'::jsonb)
returns jsonb language sql stable security invoker
set search_path = public, pg_temp
as $$
with settings as (
 select coalesce(params -> 'filters', '{}'::jsonb) as f,
        public.mobile_filter_fold(params ->> 'q') as q,
        public.mobile_filter_fold(params ->> 'root') as root,
        coalesce((params ->> 'rootOnly')::boolean, false) as root_only,
        array(select public.mobile_filter_fold(value) from jsonb_array_elements_text(coalesce(params -> 'labels', '[]'::jsonb))) as labels
), filtered as not materialized (
 select card.* from public.listing_public_cards card cross join settings s
 where card.status = 'active'
 and (coalesce(s.f ->> 'currency','') = '' or coalesce(card.currency,'TRY') = s.f ->> 'currency')
 and (coalesce(s.f ->> 'excludeOwner','') = '' or card.owner_id::text <> s.f ->> 'excludeOwner')
 and (coalesce(params ->> 'sort','') <> 'featured' or card.featured is true)
 and (s.q = '' or position(s.q in public.mobile_filter_fold(concat_ws(' ',card.title,card.description,card.category,card.location,array_to_string(card.tags,' ')))) > 0)
 and (s.root = '' or coalesce(card.attributes ->> '_root','') = '' or public.mobile_filter_fold(card.attributes ->> '_root') = s.root)
 and (cardinality(s.labels) = 0 or (s.root_only and public.mobile_filter_fold(card.attributes ->> '_root') = s.root)
      or public.mobile_filter_fold(card.category) = any(s.labels)
      or exists (select 1 from regexp_split_to_table(card.category, '\s*[-/>·|]\s*') part where public.mobile_filter_fold(part) = any(s.labels)))
 and (coalesce(s.f ->> 'min','') = '' or card.price >= public.mobile_filter_number(s.f -> 'min'))
 and (coalesce(s.f ->> 'max','') = '' or card.price <= public.mobile_filter_number(s.f -> 'max'))
 and (coalesce(s.f #>> '{loc,provinceId}','') = '' or card.province_id = (s.f #>> '{loc,provinceId}')::integer)
 and (coalesce(s.f #>> '{loc,districtId}','') = '' or card.district_id = (s.f #>> '{loc,districtId}')::integer)
 and (not coalesce((s.f ->> 'open')::boolean,false) or card.partnership_mode in ('open','approval'))
 and (not coalesce((s.f ->> 'photos')::boolean,false) or nullif(card.image_url,'') is not null or coalesce(array_length(card.ad_assets,1),0) > 0)
 and (not coalesce((s.f ->> 'urgent')::boolean,false) or coalesce(card.attributes ->> '_urgentUntil','') > to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
 and (not coalesce((s.f ->> 'owner')::boolean,false) or public.mobile_filter_matches(public.mobile_filter_value(card.attributes,'from'),'"true"'::jsonb))
 and (not coalesce((s.f ->> 'warranty')::boolean,false) or public.mobile_filter_matches(public.mobile_filter_value(card.attributes,'warranty'),'"true"'::jsonb))
 and (not coalesce((s.f ->> 'exchange')::boolean,false) or public.mobile_filter_matches(public.mobile_filter_value(card.attributes,'swap'),'"true"'::jsonb))
 and not exists (select 1 from jsonb_each(coalesce(s.f -> 'attrs','{}'::jsonb)) attr
                 where not public.mobile_filter_matches(public.mobile_filter_value(card.attributes,attr.key),attr.value))
 and not exists (select 1 from jsonb_each_text(coalesce(s.f -> 'texts','{}'::jsonb)) attr
                 where attr.value <> '' and position(public.mobile_filter_fold(attr.value) in public.mobile_filter_fold(public.mobile_filter_value(card.attributes,attr.key) #>> '{}')) = 0)
 and not exists (select 1 from jsonb_each(coalesce(s.f -> 'ranges','{}'::jsonb)) r
                 where (coalesce(r.value ->> 'min','') <> '' or coalesce(r.value ->> 'max','') <> '') and (
                    public.mobile_filter_number(public.mobile_filter_value(card.attributes,r.key)) is null
                    or (coalesce(r.value ->> 'min','') <> '' and public.mobile_filter_number(public.mobile_filter_value(card.attributes,r.key)) < public.mobile_filter_number(r.value -> 'min'))
                    or (coalesce(r.value ->> 'max','') <> '' and public.mobile_filter_number(public.mobile_filter_value(card.attributes,r.key)) > public.mobile_filter_number(r.value -> 'max'))))
), page as (
 select * from filtered
 order by case when params ->> 'sort' = 'popular' then coalesce(view_count,0) end desc,
          case when params ->> 'sort' = 'popular' then coalesce(favorite_count,0) end desc,
          case when params ->> 'sort' = 'priceAsc' then price end asc,
          case when params ->> 'sort' = 'priceDesc' then price end desc,
          case when params ->> 'sort' = 'commission' then commission_tl end desc,
          case when coalesce(params ->> 'sort','recommended') = 'recommended' then featured end desc nulls last,
          created_at desc, id desc
 limit least(100,greatest(1,coalesce((params ->> 'limit')::integer,24)))
 offset greatest(0,coalesce((params ->> 'offset')::integer,0))
)
select jsonb_build_object('listings',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from filtered))
$$;

revoke all on function public.mobile_catalogue_page(jsonb) from public;
grant execute on function public.mobile_catalogue_page(jsonb) to anon,authenticated;
