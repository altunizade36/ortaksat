CREATE OR REPLACE FUNCTION public.mobile_catalogue_page(params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with settings as (
 select coalesce(params -> 'filters', '{}'::jsonb) as f,
        public.mobile_filter_fold(params ->> 'q') as q,
        public.mobile_filter_fold(params ->> 'root') as root,
        coalesce((params ->> 'rootOnly')::boolean, false) as root_only,
        array(select public.mobile_filter_fold(value) from jsonb_array_elements_text(coalesce(params -> 'labels', '[]'::jsonb))) as labels,
        array(select value from jsonb_array_elements_text(coalesce(params -> 'forms', '[]'::jsonb))) as forms,
        coalesce(params ->> 'node','') as node
), filtered as not materialized (
 select card.* from public.listing_public_cards card cross join settings s
 where card.status = 'active'
 and (coalesce(s.f ->> 'currency','') = '' or coalesce(card.currency,'TRY') = s.f ->> 'currency')
 and (coalesce(s.f ->> 'excludeOwner','') = '' or card.owner_id::text <> s.f ->> 'excludeOwner')
 and (coalesce(params ->> 'sort','') <> 'featured' or card.featured is true)
 and (s.q = '' or position(s.q in public.mobile_filter_fold(concat_ws(' ',card.title,card.description,card.category,card.location,array_to_string(card.tags,' ')))) > 0)
 and (s.root = '' or coalesce(card.attributes ->> '_root','') = '' or public.mobile_filter_fold(card.attributes ->> '_root') = s.root)
   and (cardinality(s.forms) = 0 or coalesce(card.attributes ->> '_formKey','') = '' or card.attributes ->> '_formKey' = any(s.forms))
 and (cardinality(s.labels) = 0 or case when s.node <> '' and jsonb_typeof(card.attributes -> '_path') = 'array' then (card.attributes -> '_path') ? s.node else ((s.root_only and public.mobile_filter_fold(card.attributes ->> '_root') = s.root)
      or public.mobile_filter_fold(card.category) = any(s.labels)
      or exists (select 1 from regexp_split_to_table(card.category, '\s*[-/>·|]\s*') part where public.mobile_filter_fold(part) = any(s.labels))) end)
 and (coalesce(s.f ->> 'min','') = '' or card.price >= public.mobile_filter_number(s.f -> 'min'))
 and (coalesce(s.f ->> 'max','') = '' or card.price <= public.mobile_filter_number(s.f -> 'max'))
 and (coalesce(s.f #>> '{loc,provinceId}','') = '' or card.province_id = (s.f #>> '{loc,provinceId}')::integer)
 and (coalesce(s.f #>> '{loc,districtId}','') = '' or card.district_id = (s.f #>> '{loc,districtId}')::integer)
 and (not coalesce((s.f ->> 'open')::boolean,false) or card.partnership_mode in ('open','approval'))
 and (not coalesce((s.f ->> 'instant')::boolean,false) or card.partnership_mode = 'open')
 and (coalesce(s.f ->> 'minCommission','') = '' or card.commission_tl >= public.mobile_filter_number(s.f -> 'minCommission'))
 and (coalesce(s.f ->> 'minRate','') = '' or (case when card.commission_type = 'rate' then card.commission_value when card.price > 0 then round(card.commission_value / card.price * 100) else 0 end) >= public.mobile_filter_number(s.f -> 'minRate'))
 and (coalesce(s.f ->> 'commissionType','') = '' or card.commission_type = s.f ->> 'commissionType')
 and (coalesce(s.f ->> 'stock','') = '' or (s.f ->> 'stock' = 'in' and card.stock_count > 0) or (s.f ->> 'stock' = 'low' and card.stock_count between 1 and 5))
 and (not coalesce((s.f ->> 'featured')::boolean,false) or card.featured is true)
 and (coalesce(s.f ->> 'createdAfter','') = '' or card.created_at >= (s.f ->> 'createdAfter')::timestamptz)
 and (coalesce(s.f ->> 'minRating','') = '' or exists (select 1 from public.profiles p where p.id = card.owner_id and p.rating >= public.mobile_filter_number(s.f -> 'minRating')))
 and (not coalesce((s.f ->> 'verified')::boolean,false) or exists (select 1 from public.profiles p where p.id = card.owner_id and (p.verified_phone or p.verified_identity)))
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
          case when params ->> 'sort' = 'commissionRate' then (case when commission_type = 'rate' then commission_value when price > 0 then round(commission_value / price * 100) else 0 end) end desc,
          case when params ->> 'sort' = 'rating' then (select p.rating from public.profiles p where p.id = owner_id) end desc nulls last,
          case when coalesce(params ->> 'sort','recommended') = 'recommended' then featured end desc nulls last,
          created_at desc, id desc
 limit least(100,greatest(1,coalesce((params ->> 'limit')::integer,24)))
 offset greatest(0,coalesce((params ->> 'offset')::integer,0))
)
select jsonb_build_object('listings',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from filtered))
$function$;
create index if not exists listings_category_path_gin on public.listings using gin ((attributes -> '_path')) where deleted_at is null;
