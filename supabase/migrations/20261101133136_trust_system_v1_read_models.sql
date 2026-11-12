begin;
create function trust_private.read_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not exists(select 1 from public.profiles where id=u and status<>'deleted') then raise exception 'TRUST_AUTH_REQUIRED' using errcode='42501';end if;
 return u;
end $$;

create function trust_private.transaction_json(t public.partnership_transactions,u uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select case when u=t.buyer_id and u not in(t.seller_id,t.partner_id) and not trust_private.staff(u)
 then to_jsonb(t)-array['commission_status','commission_amount','due_at','seller_payment_declared_at','partner_payment_confirmed_at','payment_method','legacy_commission_id']
 else to_jsonb(t) end;
$$;

create function trust_private.dashboard(transaction_id uuid default null,cursor_at timestamptz default null,cursor_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=trust_private.read_actor(); data jsonb;begin
 if not (select enabled from trust_private.settings where id) then return jsonb_build_object('capabilities',trust_private.capabilities(),'transactions','[]'::jsonb,'agreements','[]'::jsonb,'reviews','[]'::jsonb,'disputes','[]'::jsonb,'evidence','[]'::jsonb,'events','[]'::jsonb,'responses','[]'::jsonb);end if;
 if (cursor_at is null)<>(cursor_id is null) then raise exception 'TRUST_INVALID_CURSOR';end if;
 if transaction_id is not null and not exists(select 1 from public.partnership_transactions t where t.id=transaction_id and trust_private.member(t,u)) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
 with selected as (
  select t.* from public.partnership_transactions t where trust_private.member(t,u)
   and (transaction_id is null or t.id=transaction_id)
   and (cursor_at is null or (t.created_at,t.id)<(cursor_at,cursor_id)) order by t.created_at desc,t.id desc limit 51
 ), page as(select * from selected order by created_at desc,id desc limit 50)
 select jsonb_build_object('capabilities',trust_private.capabilities(),
  'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'avatar',p.avatar_url)) from public.profiles p where p.id in(select seller_id from page union select partner_id from page union select buyer_id from page union select a.seller_id from public.partnership_agreements a where u in(a.seller_id,a.partner_id) union select a.partner_id from public.partnership_agreements a where u in(a.seller_id,a.partner_id))),'[]'::jsonb),
  'transactions',coalesce((select jsonb_agg(trust_private.transaction_json(t,u) order by t.created_at desc,t.id desc) from page t),'[]'::jsonb),
  'referralCodes',coalesce((select jsonb_object_agg(p.id,p.ref_code) from public.partnerships p where p.id in(select partnership_id from page where u in(seller_id,partner_id))),'{}'::jsonb),
  'hasMore',(select count(*)>50 from selected),
  'cursor',(select jsonb_build_object('at',created_at,'id',id) from page order by created_at,id limit 1),
  'agreements',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select a.* from public.partnership_agreements a where (u in(a.seller_id,a.partner_id) or trust_private.staff(u)) and (transaction_id is null or a.partnership_id in(select p.partnership_id from page p)) order by a.created_at desc limit 50) a),'[]'::jsonb),
  'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from public.transaction_reviews r where r.transaction_id in(select id from page) and (r.reviewer_id=u or trust_private.review_visible(r) or trust_private.staff(u))),'[]'::jsonb),
  'disputes',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.trust_disputes d where d.transaction_id in(select id from page) and (d.reason<>'commission_unpaid' or u in(select seller_id from page union select partner_id from page) or trust_private.staff(u))),'[]'::jsonb),
  'referrals',coalesce((select jsonb_agg(to_jsonb(r)-array['identity_key']) from public.buyer_referrals r where r.transaction_id in(select id from page)),'[]'::jsonb),
  'responses',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.trust_dispute_responses r join public.trust_disputes d on d.id=r.dispute_id where d.transaction_id in(select id from page) and (d.reason<>'commission_unpaid' or u in(select seller_id from page union select partner_id from page) or trust_private.staff(u))),'[]'::jsonb),
  'evidence',coalesce((select jsonb_agg(to_jsonb(e)-array['storage_path','content_hash','scanner_version']) from public.transaction_evidence e where e.transaction_id in(select id from page) and (e.uploaded_by=u or u in(select seller_id from page union select partner_id from page) or trust_private.staff(u))),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from (select user_id,action,entity_id,case when u in(select buyer_id from page) and not trust_private.staff(u) then jsonb_build_object('saleStatus',metadata->'details'->'saleStatus') else metadata->'details' end as details,created_at from public.activity_logs where action like 'trust_v1_%' and entity_id in(select id::text from page) order by created_at desc limit 250) e),'[]'::jsonb)
 ) into data;
 return data;
end $$;

create function public.trust_v1_dashboard(p_transaction_id uuid default null,p_cursor_at timestamptz default null,p_cursor_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$select trust_private.dashboard(p_transaction_id,p_cursor_at,p_cursor_id);$$;

create function trust_private.profile(user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare person record;roles jsonb:='{}';role_name text;reviews_count integer;verified_count integer;paid_count integer;payment_eligible integer;open_count integer;closed_count integer;average_rating numeric;badges jsonb:='[]';begin
 if not (select enabled from trust_private.settings where id) then return jsonb_build_object('enabled',false);end if;
 select p.id,p.full_name,p.avatar_url,p.created_at,exists(select 1 from auth.users a where a.id=p.id and a.phone_confirmed_at is not null) as phone_verified
 into person from public.profiles p where p.id=user_id and p.status<>'deleted';
 if not found then raise exception 'TRUST_PROFILE_NOT_FOUND';end if;
 if trust_private.restricted(user_id) then badges:=badges||jsonb_build_array('partnership_restricted');end if;
 if person.phone_verified then badges:=badges||jsonb_build_array('phone_verified');end if;
 foreach role_name in array array['seller','partner','buyer'] loop
  select count(*),round(avg(r.rating),2) into reviews_count,average_rating from public.transaction_reviews r
   where r.reviewed_user_id=user_id and r.subject_role=role_name and trust_private.review_visible(r);
  select count(*),count(*) filter(where t.commission_status='mutual_confirmed'),count(*) filter(where t.commission_status='mutual_confirmed' or (t.due_at<=now() and t.commission_status not in('not_earned','under_review','void')))
   into verified_count,paid_count,payment_eligible from public.partnership_transactions t
   where t.sale_verified_at is not null and case role_name when 'seller' then t.seller_id=user_id when 'partner' then t.partner_id=user_id else t.buyer_id=user_id end;
  select count(*) filter(where d.status<>'resolved'),count(*) filter(where d.status='resolved') into open_count,closed_count
   from public.trust_disputes d join public.partnership_transactions t on t.id=d.transaction_id
   where case role_name when 'seller' then t.seller_id=user_id when 'partner' then t.partner_id=user_id else t.buyer_id=user_id end;
  roles:=roles||jsonb_build_object(role_name,jsonb_build_object('reviewCount',reviews_count,'rating',average_rating,'verifiedTransactions',verified_count,
   'mutualPaymentCount',case when role_name<>'buyer' then paid_count else null end,
   'paymentConfirmationPercent',case when role_name='seller' and payment_eligible>=10 then round(paid_count*100.0/payment_eligible) else null end,
   'openDisputes',open_count,'resolvedDisputes',closed_count,'historyLabel',case when verified_count=0 then 'Henüz doğrulanmış işlem yok' else 'Doğrulanmış işlem geçmişi' end));
  if verified_count>=5 and reviews_count>=5 and average_rating>=4 and not badges ? 'positive_history' then badges:=badges||jsonb_build_array('positive_history');end if;
  if role_name='seller' and payment_eligible>=5 and paid_count=payment_eligible and not exists(select 1 from public.partnership_transactions x where x.seller_id=user_id and x.commission_status in('disputed','seller_declared','awaiting_payment')) then badges:=badges||jsonb_build_array('positive_commission');end if;
  if open_count>0 and not badges ? 'under_review' then badges:=badges||jsonb_build_array('under_review');end if;
 end loop;
 if (roles->'seller'->>'verifiedTransactions')::integer+(roles->'partner'->>'verifiedTransactions')::integer+(roles->'buyer'->>'verifiedTransactions')::integer=0 then badges:=badges||jsonb_build_array('new_user');end if;
 return jsonb_build_object('enabled',true,'user',to_jsonb(person),'roles',roles,'badges',badges,
  'criteria',jsonb_build_object('minimumPercentSample',10,'positiveHistoryMinimum',5,'positiveHistoryRating',4,'positiveCommissionMinimum',5,'reviewWindowDays',14,'paymentVerification','party_confirmation','bankVerified',false));
end $$;
create function public.trust_v1_profile(p_user_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select trust_private.profile(p_user_id);$$;

-- First authenticated buyer attribution is serialized per listing/identity. A click is not a referral.
create function trust_private.confirm_referral(transaction_id uuid,ref_code text,request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=trust_private.actor();t public.partnership_transactions;a public.partnership_agreements;previous public.buyer_referrals;new_id uuid;result jsonb;existing trust_private.requests;begin
 perform trust_private.require_enabled();
 if request is null or length(coalesce(ref_code,'')) not between 4 and 128 then raise exception 'TRUST_INVALID_REFERRAL';end if;
 perform pg_advisory_xact_lock(hashtextextended('trust_actor:'||u::text,0));
 perform pg_advisory_xact_lock(hashtextextended(u::text||request::text,0));
 select * into existing from trust_private.requests where actor_id=u and request_id=request;
 if found then
  if existing.operation<>'confirm_referral' or existing.entity_id is distinct from transaction_id or existing.payload_hash<>encode(sha256(convert_to(ref_code,'UTF8')),'hex') then raise exception 'TRUST_IDEMPOTENCY_CONFLICT';end if;
  return existing.result;
 end if;
 if (select count(*) from trust_private.requests where actor_id=u and created_at>now()-interval '1 hour')>=100 then raise exception 'TRUST_RATE_LIMIT';end if;
 select * into t from public.partnership_transactions where id=transaction_id for update;
 if not found or u in(t.seller_id,t.partner_id) or (t.buyer_id is not null and t.buyer_id<>u) then raise exception 'TRUST_REFERRAL_NOT_AVAILABLE';end if;
 if t.sale_status not in ('partnership_active','buyer_referred','negotiating') or not exists(select 1 from public.partnerships p where p.id=t.partnership_id and p.ref_code=confirm_referral.ref_code and p.status='active' and p.deleted_at is null) then raise exception 'TRUST_REFERRAL_NOT_AVAILABLE';end if;
 perform pg_advisory_xact_lock(hashtextextended(t.listing_id::text||trust_private.buyer_identity(u),0));
 select * into previous from public.buyer_referrals r where r.listing_id=t.listing_id and identity_key=trust_private.buyer_identity(u) and expires_at>now() and status<>'expired' order by confirmed_at limit 1 for update;
 if found then
  if previous.partnership_id<>t.partnership_id then raise exception 'TRUST_REFERRAL_CONFLICT';end if;
  result:=jsonb_build_object('referralId',previous.id,'transactionId',previous.transaction_id,'expiresAt',previous.expires_at);
  if previous.transaction_id=t.id and previous.buyer_id is null then
   update public.buyer_referrals set buyer_id=u where id=previous.id;
   update public.partnership_transactions set buyer_id=u,revision=revision+1,updated_at=now() where id=t.id and buyer_id is null;
   perform trust_private.event(u,t.id,'buyer_referral_claimed',jsonb_build_object('method','verified_email_account'),array[t.seller_id,t.partner_id]);
  end if;
 else
  select * into a from public.partnership_agreements where id=t.agreement_id;
  if (a.terms->>'startsAt')::timestamptz>now() or ((a.terms->>'endsAt') is not null and (a.terms->>'endsAt')::timestamptz<=now()) then raise exception 'TRUST_REFERRAL_NOT_AVAILABLE';end if;
  insert into public.buyer_referrals(transaction_id,partnership_id,listing_id,buyer_id,identity_key,confirmation_method,expires_at)
   values(t.id,t.partnership_id,t.listing_id,u,trust_private.buyer_identity(u),'authenticated_buyer',now()+make_interval(days=>(a.terms->>'attributionDays')::integer)) returning id into new_id;
  update public.partnership_transactions set buyer_id=u,sale_status=case when sale_status='partnership_active' then 'buyer_referred' else sale_status end,revision=revision+1,updated_at=now() where id=t.id;
  result:=jsonb_build_object('referralId',new_id,'transactionId',t.id,'expiresAt',now()+make_interval(days=>(a.terms->>'attributionDays')::integer));
  perform trust_private.event(u,t.id,'buyer_referral_confirmed',jsonb_build_object('method','authenticated_buyer'),array[t.seller_id,t.partner_id]);
 end if;
 insert into trust_private.requests(actor_id,request_id,operation,entity_id,result,payload_hash) values(u,request,'confirm_referral',t.id,result,encode(sha256(convert_to(ref_code,'UTF8')),'hex'));
 return result;
end $$;
create function public.trust_v1_confirm_referral(p_transaction_id uuid,p_ref_code text,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select trust_private.confirm_referral(p_transaction_id,p_ref_code,p_request_id);$$;

-- Explicit rollback support: disable writes without dropping historical agreements or evidence.
create function trust_private.disable_system() returns void language plpgsql security definer set search_path='' as $$
begin update trust_private.settings set enabled=false,scanner_ready=false,guest_referrals_ready=false;end $$;
revoke all on all functions in schema trust_private from public,anon,authenticated;
grant execute on function trust_private.capabilities(),trust_private.profile(uuid) to anon,authenticated;
grant execute on function trust_private.command(text,uuid,jsonb,uuid,integer),trust_private.dashboard(uuid,timestamptz,uuid),trust_private.confirm_referral(uuid,text,uuid) to authenticated;
revoke all on function public.trust_v1_dashboard(uuid,timestamptz,uuid),public.trust_v1_confirm_referral(uuid,text,uuid) from public,anon;
grant execute on function public.trust_v1_dashboard(uuid,timestamptz,uuid),public.trust_v1_confirm_referral(uuid,text,uuid) to authenticated;
revoke all on function public.trust_v1_profile(uuid) from public;
grant execute on function public.trust_v1_profile(uuid) to anon,authenticated;
grant execute on function trust_private.disable_system() to service_role;
commit;
