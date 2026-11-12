-- Trust 1.0 is additive and OFF by default. No historical acceptance/payment is inferred.
begin;
create schema if not exists trust_private;
revoke all on schema trust_private from public, anon, authenticated;
grant usage on schema trust_private to authenticated, anon, service_role;

create table trust_private.settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 phone_required boolean not null default true, sms_ready boolean not null default false, scanner_ready boolean not null default false,
 guest_referrals_ready boolean not null default false, ortakpay_enabled boolean not null default false check(not ortakpay_enabled)
);
insert into trust_private.settings(id) values(true);
revoke all on trust_private.settings from public, anon, authenticated;

create table public.partnership_agreements (
 id uuid primary key default gen_random_uuid(), partnership_id uuid not null references public.partnerships(id),
 listing_id uuid not null references public.listings(id), seller_id uuid not null references public.profiles(id),
 partner_id uuid not null references public.profiles(id), version integer not null check(version>0),
 terms jsonb not null check(jsonb_typeof(terms)='object'), terms_hash text not null,
 seller_accepted_at timestamptz, partner_accepted_at timestamptz, finalized_at timestamptz,
 created_at timestamptz not null default now(), check(seller_id<>partner_id), unique(partnership_id,version),
 check(finalized_at is null or (seller_accepted_at is not null and partner_accepted_at is not null))
);
create table public.partnership_transactions (
 id uuid primary key default gen_random_uuid(), partnership_id uuid not null references public.partnerships(id),
 agreement_id uuid not null references public.partnership_agreements(id), listing_id uuid not null references public.listings(id),
 seller_id uuid not null references public.profiles(id), partner_id uuid not null references public.profiles(id),
 buyer_id uuid references public.profiles(id), legacy_commission_id uuid unique references public.commissions(id),
 sale_status text not null default 'partnership_active' check(sale_status in ('partnership_active','buyer_referred','negotiating','sale_reported','verification_pending','sale_verified','not_sold','cancelled','disputed')),
 commission_status text not null default 'not_earned' check(commission_status in ('not_earned','under_review','earned','awaiting_payment','seller_declared','mutual_confirmed','disputed','void')),
 sale_amount numeric(16,2) check(sale_amount>=0), commission_amount numeric(16,2) check(commission_amount>=0),
 currency text not null check(currency in ('TRY','USD','EUR')),
 seller_sale_confirmed_at timestamptz, partner_sale_confirmed_at timestamptz, sale_verified_at timestamptz,
 due_at timestamptz, seller_payment_declared_at timestamptz, partner_payment_confirmed_at timestamptz,
 payment_method text check(payment_method is null or payment_method='party_confirmation'),
 revision integer not null default 1 check(revision>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(seller_id<>partner_id),check(buyer_id is null or buyer_id not in (seller_id,partner_id)),
 check(commission_status<>'mutual_confirmed' or (seller_payment_declared_at is not null and partner_payment_confirmed_at is not null and payment_method='party_confirmation'))
);
create index trust_transactions_seller on public.partnership_transactions(seller_id,created_at desc);
create index trust_transactions_partner on public.partnership_transactions(partner_id,created_at desc);
create index trust_transactions_buyer on public.partnership_transactions(buyer_id,created_at desc) where buyer_id is not null;

create table public.buyer_referrals (
 id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.partnership_transactions(id),
 partnership_id uuid not null references public.partnerships(id), listing_id uuid not null references public.listings(id),
 buyer_id uuid references public.profiles(id), identity_key text not null,
 confirmation_method text not null check(confirmation_method in ('authenticated_buyer','verified_email')),
 status text not null default 'confirmed' check(status in ('confirmed','seller_accepted','contested','expired')),
 confirmed_at timestamptz not null default now(), expires_at timestamptz not null,
 seller_reason text check(length(seller_reason)<=2000),check(expires_at>confirmed_at)
);
create index trust_referral_identity on public.buyer_referrals(listing_id,identity_key,confirmed_at);
create index trust_referral_transaction on public.buyer_referrals(transaction_id);

create table public.trust_disputes (
 id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.partnership_transactions(id),
 opened_by uuid not null references public.profiles(id),
 reason text not null check(reason in ('commission_unpaid','sale_concealed','incorrect_product','referral_conflict','misleading_evidence','other')),
 details text not null check(length(details) between 10 and 4000),
 status text not null default 'open' check(status in ('open','reviewing','resolved')),
 outcome text check(outcome in ('upheld','dismissed','resolved_by_parties','insufficient_evidence')),
 decision text check(length(decision) between 10 and 4000), decided_by uuid references public.profiles(id), decided_at timestamptz,
 response_due_at timestamptz not null default(now()+interval '14 days'),
 prior_sale_status text not null, prior_commission_status text not null, created_at timestamptz not null default now(),
 check(status<>'resolved' or (outcome is not null and decision is not null and decided_by is not null and decided_at is not null))
);
create unique index trust_one_open_dispute on public.trust_disputes(transaction_id) where status<>'resolved';
create table public.trust_dispute_responses (
 id uuid primary key default gen_random_uuid(), dispute_id uuid not null references public.trust_disputes(id),
 author_id uuid not null references public.profiles(id), body text not null check(length(body) between 1 and 4000),
 evidence_ids uuid[] not null default '{}',created_at timestamptz not null default now()
);
create table public.transaction_evidence (
 id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.partnership_transactions(id),
 uploaded_by uuid not null references public.profiles(id),
 kind text not null check(kind in ('receipt','invoice','sales_slip','delivery','product_photo','correspondence','other')),
 storage_path text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')),
 byte_size integer not null check(byte_size between 1 and 5242880),
 scan_status text not null default 'quarantined' check(scan_status in ('quarantined','clean','rejected','deleted')),
 content_hash text, scanner_version text, scanned_at timestamptz, created_at timestamptz not null default now(),
 retention_until timestamptz not null default(now()+interval '180 days'),
 check(scan_status<>'clean' or (content_hash is not null and scanner_version is not null and scanned_at is not null))
);
create table public.transaction_reviews (
 id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.partnership_transactions(id),
 reviewer_id uuid not null references public.profiles(id), reviewed_user_id uuid not null references public.profiles(id),
 reviewer_role text not null check(reviewer_role in ('seller','partner','buyer')),
 subject_role text not null check(subject_role in ('seller','partner','buyer')),
 dimensions jsonb not null, rating numeric(3,2) not null check(rating between 1 and 5),
 comment text not null default '' check(length(comment)<=2000), submitted_at timestamptz not null default now(),
 reveal_at timestamptz not null, hidden_at timestamptz,
 check(reviewer_id<>reviewed_user_id),unique(transaction_id,reviewer_id,reviewed_user_id)
);
create index trust_reviews_subject on public.transaction_reviews(reviewed_user_id,subject_role,reveal_at);
create table trust_private.requests (
 actor_id uuid not null,request_id uuid not null,operation text not null,entity_id uuid,
 result jsonb not null,payload_hash text not null,created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
revoke all on trust_private.requests from public,anon,authenticated;

-- RLS is defense in depth. Client reads/writes only use the scoped RPC surface below.
do $$ declare t text;begin
 foreach t in array array['partnership_agreements','partnership_transactions','buyer_referrals','trust_disputes','trust_dispute_responses','transaction_evidence','transaction_reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('create policy trust_rpc_only on public.%I for all to anon,authenticated using(false) with check(false)',t);
 end loop;
end $$;

create function trust_private.actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not exists(select 1 from public.profiles where id=u and status='active') then raise exception 'TRUST_AUTH_REQUIRED' using errcode='42501';end if;
 return u;
end $$;
create function trust_private.staff(u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=u and role in ('admin','moderator','super_admin') and status='active');
$$;
create function trust_private.require_enabled() returns void language plpgsql stable security definer set search_path='' as $$
begin if not coalesce((select enabled from trust_private.settings where id),false) then raise exception 'TRUST_DISABLED' using errcode='55000';end if;end $$;
create function trust_private.require_phone(u uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if (select phone_required from trust_private.settings where id) and not exists(select 1 from auth.users where id=u and phone_confirmed_at is not null) then
  raise exception 'TRUST_PHONE_VERIFICATION_REQUIRED' using errcode='42501';
 end if;
end $$;
create function trust_private.member(t public.partnership_transactions,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(u is not null and (u=t.seller_id or u=t.partner_id or u=t.buyer_id or trust_private.staff(u)),false);
$$;
create function trust_private.review_visible(r public.transaction_reviews) returns boolean language sql stable security definer set search_path='' as $$
 select r.hidden_at is null and (r.reveal_at<=now() or exists(select 1 from public.transaction_reviews x where x.transaction_id=r.transaction_id and x.reviewer_id=r.reviewed_user_id and x.reviewed_user_id=r.reviewer_id and x.hidden_at is null));
$$;

create function trust_private.immutable_agreement() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'TRUST_AGREEMENT_IMMUTABLE';end if;
 if (to_jsonb(new)-array['seller_accepted_at','partner_accepted_at','finalized_at']) is distinct from (to_jsonb(old)-array['seller_accepted_at','partner_accepted_at','finalized_at'])
 or old.finalized_at is not null or (old.seller_accepted_at is not null and new.seller_accepted_at is distinct from old.seller_accepted_at)
 or (old.partner_accepted_at is not null and new.partner_accepted_at is distinct from old.partner_accepted_at) then raise exception 'TRUST_AGREEMENT_IMMUTABLE';end if;
 return new;
end $$;
create trigger trust_agreement_immutable before update or delete on public.partnership_agreements for each row execute function trust_private.immutable_agreement();

create function trust_private.event(u uuid,entity uuid,action text,details jsonb,recipients uuid[] default '{}') returns void language plpgsql security definer set search_path='' as $$
declare event_id uuid:=gen_random_uuid();recipient uuid;begin
 insert into public.activity_logs(user_id,action,entity_type,entity_id,metadata)
 values(u,'trust_v1_'||action,'trust_transaction',entity::text,jsonb_build_object('event_id',event_id,'details',details));
 for recipient in select distinct x from unnest(recipients) x where x is not null and x is distinct from u loop
  insert into public.notifications(id,user_id,type,title,body,read,metadata)
  values(gen_random_uuid(),recipient,'system','İşlem dosyası güncellendi','Anlaşma, işlem veya komisyon kaydındaki güncellemeyi inceleyebilirsin.',false,
    jsonb_build_object('trust_event',event_id,'trust_action',action)||case when action in('propose_agreement','accept_agreement') then jsonb_build_object('trust_agreement_id',entity) else jsonb_build_object('trust_transaction_id',entity) end);
 end loop;
end $$;

create function trust_private.capabilities() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',enabled,'phoneRequired',phone_required,'phoneVerificationAvailable',sms_ready,'evidenceScanningAvailable',scanner_ready,'guestReferralsAvailable',guest_referrals_ready,'paymentsEnabled',false) from trust_private.settings where id;
$$;
create function public.trust_v1_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$select trust_private.capabilities();$$;

-- One serialized, idempotent command boundary for web and native. Roles never come from client metadata.
create function trust_private.command(op text,entity uuid,payload jsonb,request uuid,expected_revision integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=trust_private.actor(); prior trust_private.requests; result jsonb; t public.partnership_transactions;
 a public.partnership_agreements; p public.partnerships; l public.listings; d public.trust_disputes;
 terms jsonb; next_version integer; target text; why text; n numeric; value numeric; role_name text; target_user uuid;
 ledger public.commissions; old_sale text; old_commission text; evidence_ids uuid[]; keys text[]; k text; ratings numeric[]:='{}'; new_id uuid; deadline timestamptz; is_seller boolean; is_partner boolean;
begin
 perform trust_private.require_enabled();
 if op in('propose_agreement','accept_agreement','create_transaction') and trust_private.restricted(u) then raise exception 'TRUST_PARTNERSHIP_RESTRICTED';end if;
 if request is null or payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>16384 then raise exception 'TRUST_INVALID_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtextextended('trust_actor:'||u::text,0));
 perform pg_advisory_xact_lock(hashtextextended(u::text||request::text,0));
 select * into prior from trust_private.requests where actor_id=u and request_id=request;
 if found then
  if prior.operation<>op or prior.entity_id is distinct from entity or prior.payload_hash<>encode(sha256(convert_to(payload::text,'UTF8')),'hex') then raise exception 'TRUST_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 if (select count(*) from trust_private.requests where actor_id=u and created_at>now()-interval '1 hour')>=100 then raise exception 'TRUST_RATE_LIMIT';end if;

 if op='propose_agreement' then
  perform trust_private.require_phone(u);
  select * into p from public.partnerships where id=entity and status='active' and deleted_at is null for update;
  if not found then raise exception 'TRUST_ACTIVE_PARTNERSHIP_REQUIRED';end if;
  select * into l from public.listings where id=p.listing_id;
  if l.owner_id is distinct from u or p.partner_id=u then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
  if payload->>'commissionType' is null or payload->>'commissionType' not in ('fixed','rate') then raise exception 'TRUST_INVALID_COMMISSION';end if;
  value:=(payload->>'commissionValue')::numeric;
  if value is null or value<=0 or value<>round(value,2) or value>999999999999 or (payload->>'commissionType'='rate' and value>90) then raise exception 'TRUST_INVALID_COMMISSION';end if;
  if payload->>'attributionDays' is null or payload->>'dueDays' is null or (payload->>'attributionDays')::integer not between 1 and 365 or (payload->>'dueDays')::integer not between 0 and 365 then raise exception 'TRUST_INVALID_WINDOW';end if;
  if (payload->>'startsAt')::timestamptz is null or ((payload->>'endsAt') is not null and (payload->>'endsAt')::timestamptz<=(payload->>'startsAt')::timestamptz) then raise exception 'TRUST_INVALID_DATES';end if;
  if length(coalesce(payload->>'cancellation','')) not between 10 and 2000 or length(coalesce(payload->>'disputes','')) not between 10 and 2000 then raise exception 'TRUST_TERMS_REQUIRED';end if;
  terms:=jsonb_build_object('listingId',l.id,'listingTitle',l.title,'sellerId',u,'partnerId',p.partner_id,'currency',coalesce(l.currency,'TRY'),
   'commissionType',payload->>'commissionType','commissionValue',value,'calculation','verified_sale_amount','entitlement','verified_sale',
   'startsAt',(payload->>'startsAt')::timestamptz,'endsAt',(payload->>'endsAt')::timestamptz,
   'attributionDays',(payload->>'attributionDays')::integer,'dueDays',(payload->>'dueDays')::integer,
   'cancellation',payload->>'cancellation','disputes',payload->>'disputes','notElectronicSignature',true,'notPaymentGuarantee',true);
  select coalesce(max(version),0)+1 into next_version from public.partnership_agreements where partnership_id=p.id;
  insert into public.partnership_agreements(partnership_id,listing_id,seller_id,partner_id,version,terms,terms_hash)
   values(p.id,l.id,u,p.partner_id,next_version,terms,encode(sha256(convert_to(terms::text,'UTF8')),'hex')) returning id into new_id;
  result:=jsonb_build_object('agreementId',new_id,'version',next_version);
  perform trust_private.event(u,new_id,op,jsonb_build_object('partnershipId',p.id,'version',next_version),array[p.partner_id]);

 elsif op='accept_agreement' then
  perform trust_private.require_phone(u);
  select * into a from public.partnership_agreements where id=entity for update;
  if not found or u not in (a.seller_id,a.partner_id) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
  if payload->>'termsHash' is distinct from a.terms_hash then raise exception 'TRUST_TERMS_CHANGED';end if;
  if a.finalized_at is null and ((u=a.seller_id and a.seller_accepted_at is null) or (u=a.partner_id and a.partner_accepted_at is null)) then
   update public.partnership_agreements set seller_accepted_at=case when u=a.seller_id then coalesce(seller_accepted_at,now()) else seller_accepted_at end,
    partner_accepted_at=case when u=a.partner_id then coalesce(partner_accepted_at,now()) else partner_accepted_at end where public.partnership_agreements.id=a.id returning * into a;
   if a.seller_accepted_at is not null and a.partner_accepted_at is not null then
    update public.partnership_agreements set finalized_at=now() where public.partnership_agreements.id=a.id returning * into a;
   end if;
   perform trust_private.event(u,a.id,op,jsonb_build_object('version',a.version),array[a.seller_id,a.partner_id]);
  end if;
  result:=jsonb_build_object('agreementId',a.id,'finalized',a.finalized_at is not null);

 elsif op='create_transaction' then
  perform trust_private.require_phone(u);
  select * into a from public.partnership_agreements where public.partnership_agreements.id=entity for update;
  if not found or u not in(a.seller_id,a.partner_id) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
  if a.finalized_at is null or (a.terms->>'startsAt')::timestamptz>now() or ((a.terms->>'endsAt') is not null and (a.terms->>'endsAt')::timestamptz<=now()) then raise exception 'TRUST_VALID_AGREEMENT_REQUIRED';end if;
  if not exists(select 1 from public.partnerships where public.partnerships.id=a.partnership_id and status='active' and deleted_at is null) then raise exception 'TRUST_ACTIVE_PARTNERSHIP_REQUIRED';end if;
  select * into t from public.partnership_transactions x where x.agreement_id=a.id and x.buyer_id is null and x.sale_status in('partnership_active','negotiating','sale_reported','verification_pending') and not exists(select 1 from public.buyer_referrals r where r.transaction_id=x.id) order by x.created_at limit 1;
  if not found then
  insert into public.partnership_transactions(partnership_id,agreement_id,listing_id,seller_id,partner_id,currency)
   values(a.partnership_id,a.id,a.listing_id,a.seller_id,a.partner_id,a.terms->>'currency') returning * into t;
  perform trust_private.event(u,t.id,op,'{}',array[t.seller_id,t.partner_id]);
  end if;
  result:=jsonb_build_object('transactionId',t.id,'revision',t.revision);

 else
  select * into t from public.partnership_transactions where public.partnership_transactions.id=entity for update;
  if not found or not trust_private.member(t,u) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
  if expected_revision is null or expected_revision<>t.revision then raise exception 'TRUST_CONFLICT' using errcode='40001';end if;
  select * into a from public.partnership_agreements where public.partnership_agreements.id=t.agreement_id;
  is_seller:=u=t.seller_id;is_partner:=u=t.partner_id;old_sale:=t.sale_status;old_commission:=t.commission_status;
  why:=trim(coalesce(payload->>'reason',''));

  if op='link_ledger' then
   if not(is_seller or is_partner) or t.sale_status not in('partnership_active','buyer_referred','negotiating') then raise exception 'TRUST_INVALID_TRANSITION';end if;
   select * into ledger from public.commissions where id=(payload->>'commissionId')::uuid for update;
   if not found or ledger.partnership_id<>t.partnership_id or ledger.listing_id<>t.listing_id or ledger.deleted_at is not null or ledger.status::text not in('approved','seller_paid','return_pending') then raise exception 'TRUST_LEDGER_MISMATCH';end if;
   update public.partnership_transactions set legacy_commission_id=ledger.id where id=t.id;

  elsif op='adopt_agreement' then
   if not(is_seller or is_partner) or t.sale_status not in('partnership_active','buyer_referred','negotiating') then raise exception 'TRUST_INVALID_TRANSITION';end if;
   select * into a from public.partnership_agreements where id=(payload->>'agreementId')::uuid;
   if not found or a.partnership_id<>t.partnership_id or a.seller_id<>t.seller_id or a.partner_id<>t.partner_id or a.version<=(select version from public.partnership_agreements where id=t.agreement_id) or a.finalized_at is null or (a.terms->>'startsAt')::timestamptz>now() or ((a.terms->>'endsAt') is not null and (a.terms->>'endsAt')::timestamptz<=now()) then raise exception 'TRUST_VALID_AGREEMENT_REQUIRED';end if;
   update public.partnership_transactions set agreement_id=a.id where id=t.id;

  elsif op in('accept_referral','contest_referral') then
   if not is_seller then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
   if op='contest_referral' and length(why) not between 10 and 2000 then raise exception 'TRUST_REASON_REQUIRED';end if;
   update public.buyer_referrals set status=case op when 'accept_referral' then 'seller_accepted' else 'contested' end,seller_reason=nullif(why,'')
   where transaction_id=t.id and status in('confirmed','contested') and expires_at>now();
   if not found then raise exception 'TRUST_REFERRAL_NOT_AVAILABLE';end if;

  elsif op='report_sale' then
   if not(is_seller or is_partner) or t.sale_status not in ('partnership_active','buyer_referred','negotiating') then raise exception 'TRUST_INVALID_TRANSITION';end if;
   n:=(payload->>'amount')::numeric;
   if n is null or n<=0 or n>999999999999 or n<>round(n,2) then raise exception 'TRUST_INVALID_AMOUNT';end if;
   value:=case when a.terms->>'commissionType'='rate' then round(n*(a.terms->>'commissionValue')::numeric/100,2) else (a.terms->>'commissionValue')::numeric end;
   update public.partnership_transactions set sale_status='sale_reported',commission_status='under_review',sale_amount=n,commission_amount=value where public.partnership_transactions.id=t.id;

  elsif op='confirm_sale' then
   if not(is_seller or is_partner) or t.sale_status not in ('sale_reported','verification_pending') then raise exception 'TRUST_INVALID_TRANSITION';end if;
   update public.partnership_transactions set sale_status='verification_pending',
    seller_sale_confirmed_at=case when is_seller then coalesce(seller_sale_confirmed_at,now()) else seller_sale_confirmed_at end,
    partner_sale_confirmed_at=case when is_partner then coalesce(partner_sale_confirmed_at,now()) else partner_sale_confirmed_at end where public.partnership_transactions.id=t.id returning * into t;
   if t.seller_sale_confirmed_at is not null and t.partner_sale_confirmed_at is not null then
    update public.partnership_transactions set sale_status='sale_verified',sale_verified_at=now(),commission_status='earned',due_at=now()+make_interval(days=>(a.terms->>'dueDays')::integer) where public.partnership_transactions.id=t.id;
   end if;

  elsif op='negotiate' then
   if not(is_seller or is_partner) or t.sale_status not in ('partnership_active','buyer_referred') then raise exception 'TRUST_INVALID_TRANSITION';end if;
   update public.partnership_transactions set sale_status='negotiating' where public.partnership_transactions.id=t.id;

  elsif op in ('not_sold','cancel') then
   if not(is_seller or is_partner) or t.sale_status not in ('partnership_active','buyer_referred','negotiating','sale_reported','verification_pending') or length(why) not between 10 and 2000 then raise exception 'TRUST_INVALID_TRANSITION';end if;
   update public.partnership_transactions set sale_status=case when op='cancel' then 'cancelled' else 'not_sold' end,commission_status='void' where public.partnership_transactions.id=t.id;

  elsif op='request_payment' then
   if not is_partner or t.commission_status<>'earned' then raise exception 'TRUST_INVALID_TRANSITION';end if;
   update public.partnership_transactions set commission_status='awaiting_payment' where public.partnership_transactions.id=t.id;

  elsif op='declare_payment' then
   if not is_seller or t.commission_status not in ('earned','awaiting_payment') then raise exception 'TRUST_INVALID_TRANSITION';end if;
   update public.partnership_transactions set commission_status='seller_declared',seller_payment_declared_at=now() where public.partnership_transactions.id=t.id;

  elsif op='confirm_payment' then
   if not is_partner or t.commission_status<>'seller_declared' then raise exception 'TRUST_INVALID_TRANSITION';end if;
   update public.partnership_transactions set commission_status='mutual_confirmed',partner_payment_confirmed_at=now(),payment_method='party_confirmation' where public.partnership_transactions.id=t.id;

  elsif op='open_dispute' then
   if length(why) not between 10 and 4000 then raise exception 'TRUST_REASON_REQUIRED';end if;
   if payload->>'kind'='commission_unpaid' and not(is_seller or is_partner) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
   insert into public.trust_disputes(transaction_id,opened_by,reason,details,prior_sale_status,prior_commission_status)
    values(t.id,u,payload->>'kind',why,t.sale_status,t.commission_status) returning public.trust_disputes.id into new_id;
   update public.partnership_transactions set sale_status='disputed',commission_status=case when payload->>'kind'='commission_unpaid' then 'disputed' else commission_status end where public.partnership_transactions.id=t.id;
   result:=jsonb_build_object('disputeId',new_id);

  elsif op='respond_dispute' then
   select * into d from public.trust_disputes where transaction_id=t.id and status<>'resolved' for update;
   if not found or length(why) not between 1 and 4000 then raise exception 'TRUST_INVALID_DISPUTE_RESPONSE';end if;
   if d.reason='commission_unpaid' and not(is_seller or is_partner or trust_private.staff(u)) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
   if payload ? 'evidenceIds' and (jsonb_typeof(payload->'evidenceIds')<>'array' or jsonb_array_length(payload->'evidenceIds')>10) then raise exception 'TRUST_INVALID_EVIDENCE';end if;
   select coalesce(array_agg(x::uuid),'{}') into evidence_ids from jsonb_array_elements_text(coalesce(payload->'evidenceIds','[]')) x;
   if exists(select 1 from unnest(evidence_ids) x where not exists(select 1 from public.transaction_evidence e where e.id=x and e.transaction_id=t.id and e.scan_status='clean' and (u in(t.seller_id,t.partner_id) or e.uploaded_by=u or trust_private.staff(u)))) then raise exception 'TRUST_INVALID_EVIDENCE';end if;
   insert into public.trust_dispute_responses(dispute_id,author_id,body,evidence_ids) values(d.id,u,why,evidence_ids);

  elsif op='resolve_dispute' then
   if not trust_private.staff(u) or u in(t.seller_id,t.partner_id,coalesce(t.buyer_id,t.seller_id)) or length(why) not between 10 and 4000 then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
   select * into d from public.trust_disputes where transaction_id=t.id and status<>'resolved' for update;
   if not found then raise exception 'TRUST_DISPUTE_NOT_FOUND';end if;
   if now()<d.response_due_at then raise exception 'TRUST_RESPONSE_WINDOW_OPEN';end if;
   update public.trust_disputes set status='resolved',outcome=payload->>'outcome',decision=why,decided_by=u,decided_at=now() where public.trust_disputes.id=d.id;
   -- Closing a case does not forge a sale, mutual payment confirmation or sanction.
   update public.partnership_transactions set sale_status=d.prior_sale_status,commission_status=d.prior_commission_status where public.partnership_transactions.id=t.id;

  elsif op='review' then
   if u not in (t.seller_id,t.partner_id,coalesce(t.buyer_id,t.seller_id)) or t.sale_verified_at is null or now()>t.sale_verified_at+interval '14 days' then raise exception 'TRUST_REVIEW_INELIGIBLE';end if;
   target:=payload->>'subjectRole';
   target_user:=case target when 'seller' then t.seller_id when 'partner' then t.partner_id when 'buyer' then t.buyer_id else null end;
   if target_user is null or target_user=u then raise exception 'TRUST_REVIEW_INELIGIBLE';end if;
   role_name:=case when is_seller then 'seller' when is_partner then 'partner' else 'buyer' end;
   keys:=case target when 'seller' then array['payment','accuracy','communication','agreement'] when 'partner' then array['referral','communication','accuracy','agreement'] else array['communication','appointment','experience'] end;
   if jsonb_typeof(payload->'dimensions')<>'object' or (select count(*) from jsonb_object_keys(payload->'dimensions'))<>cardinality(keys) then raise exception 'TRUST_INVALID_RATINGS';end if;
   foreach k in array keys loop
    n:=(payload->'dimensions'->>k)::numeric;
    if n is null or n not between 1 and 5 or n<>trunc(n) then raise exception 'TRUST_INVALID_RATINGS';end if;
    ratings:=array_append(ratings,n);
   end loop;
   insert into public.transaction_reviews(transaction_id,reviewer_id,reviewed_user_id,reviewer_role,subject_role,dimensions,rating,comment,reveal_at)
    values(t.id,u,target_user,role_name,target,payload->'dimensions',(select avg(x) from unnest(ratings) x),coalesce(payload->>'comment',''),t.sale_verified_at+interval '14 days') returning public.transaction_reviews.id into new_id;
   result:=jsonb_build_object('reviewId',new_id,'revealAt',t.sale_verified_at+interval '14 days');

  else raise exception 'TRUST_UNKNOWN_OPERATION';end if;
  if op='confirm_sale' and exists(select 1 from public.partnership_transactions x where x.id=t.id and x.sale_status='sale_verified') then perform trust_private.ensure_ledger(t.id);end if;
  if op<>'link_ledger' then perform trust_private.sync_ledger(t.id);end if;
  update public.partnership_transactions set revision=revision+1,updated_at=now() where public.partnership_transactions.id=t.id returning * into t;
  result:=coalesce(result,'{}'::jsonb)||jsonb_build_object('transactionId',t.id,'revision',t.revision,'saleStatus',t.sale_status,'commissionStatus',t.commission_status);
  perform trust_private.event(u,t.id,op,jsonb_build_object('previousSaleStatus',old_sale,'saleStatus',t.sale_status,'previousCommissionStatus',old_commission,'commissionStatus',t.commission_status,'revision',t.revision,'reason',why),array[t.seller_id,t.partner_id,t.buyer_id]);
 end if;
 insert into trust_private.requests(actor_id,request_id,operation,entity_id,result,payload_hash) values(u,request,op,entity,result,encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
 return result;
end $$;

create function public.trust_v1_command(p_operation text,p_entity_id uuid,p_payload jsonb,p_request_id uuid,p_revision integer default null)
returns jsonb language sql security invoker set search_path='' as $$select trust_private.command(p_operation,p_entity_id,p_payload,p_request_id,p_revision);$$;

-- Privileged helpers are not API schemas and have no default PUBLIC execute grant.
revoke all on all functions in schema trust_private from public,anon,authenticated;
grant execute on function trust_private.capabilities() to anon,authenticated;
grant execute on function trust_private.command(text,uuid,jsonb,uuid,integer) to authenticated;
revoke all on function public.trust_v1_command(text,uuid,jsonb,uuid,integer) from public,anon;
grant execute on function public.trust_v1_command(text,uuid,jsonb,uuid,integer) to authenticated;
revoke all on function public.trust_v1_capabilities() from public;
grant execute on function public.trust_v1_capabilities() to anon,authenticated;
commit;
