begin;
alter table trust_private.settings add column identity_salt text not null default(gen_random_uuid()::text||gen_random_uuid()::text);
create table trust_private.guest_challenges (
 id uuid primary key,transaction_id uuid not null references public.partnership_transactions(id),identity_key text not null,
 code_hash text not null check(code_hash ~ '^[a-f0-9]{64}$'),ip_hash text not null,created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '10 minutes'),attempts integer not null default 0,
 consumed_at timestamptz,result jsonb
);
revoke all on trust_private.guest_challenges from public,anon,authenticated;
create function trust_private.email_identity(email text) returns text language sql stable security definer set search_path='' as $$
 select 'email:'||encode(sha256(convert_to(identity_salt||':'||lower(trim(email)),'UTF8')),'hex') from trust_private.settings where id;
$$;
create function trust_private.buyer_identity(u uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select trust_private.email_identity(a.email) from auth.users a where a.id=u and a.email_confirmed_at is not null and a.email is not null),u::text);
$$;
create function trust_private.guest_begin(transaction_id uuid,ref_code text,email text,code_hash text,ip_hash text,challenge_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.partnership_transactions;identity text;begin
 perform trust_private.require_enabled();
 if not(select guest_referrals_ready from trust_private.settings where id) then raise exception 'TRUST_GUEST_UNAVAILABLE';end if;
 if challenge_id is null or email is null or length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or code_hash is null or code_hash !~ '^[a-f0-9]{64}$' or ip_hash is null or ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'TRUST_INVALID_REQUEST';end if;
 identity:=trust_private.email_identity(email);
 perform pg_advisory_xact_lock(hashtextextended('guest_ip:'||ip_hash,0));
 perform pg_advisory_xact_lock(hashtextextended('guest_email:'||identity,0));
 if (select count(*) from trust_private.guest_challenges c where c.ip_hash=guest_begin.ip_hash and c.created_at>now()-interval '1 hour')>=20 or (select count(*) from trust_private.guest_challenges c where c.identity_key=identity and c.created_at>now()-interval '1 hour')>=5 then raise exception 'TRUST_RATE_LIMIT';end if;
 select * into t from public.partnership_transactions where id=transaction_id;
 if not found or t.sale_status not in('partnership_active','buyer_referred','negotiating') or not exists(select 1 from public.partnerships p where p.id=t.partnership_id and p.status='active' and p.deleted_at is null and p.ref_code=guest_begin.ref_code) then raise exception 'TRUST_REFERRAL_NOT_AVAILABLE';end if;
 if exists(select 1 from auth.users a where a.id in(t.seller_id,t.partner_id) and trust_private.email_identity(a.email)=identity) then raise exception 'TRUST_REFERRAL_NOT_AVAILABLE';end if;
 insert into trust_private.guest_challenges(id,transaction_id,identity_key,code_hash,ip_hash) values(challenge_id,t.id,identity,code_hash,ip_hash);
 return jsonb_build_object('challengeId',challenge_id,'expiresIn',600);
end $$;
create function public.trust_v1_guest_begin(p_transaction_id uuid,p_ref_code text,p_email text,p_code_hash text,p_ip_hash text,p_challenge_id uuid) returns jsonb language sql security invoker set search_path='' as $$select trust_private.guest_begin(p_transaction_id,p_ref_code,p_email,p_code_hash,p_ip_hash,p_challenge_id);$$;

create function trust_private.guest_confirm(challenge_id uuid,code_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c trust_private.guest_challenges;t public.partnership_transactions;a public.partnership_agreements;r public.buyer_referrals;new_id uuid;response_data jsonb;begin
 perform trust_private.require_enabled();
 if not(select guest_referrals_ready from trust_private.settings where id) then raise exception 'TRUST_GUEST_UNAVAILABLE';end if;
 select * into c from trust_private.guest_challenges where id=challenge_id for update;
 if not found or c.expires_at<=now() or c.attempts>=5 then return jsonb_build_object('ok',false,'error','invalid_or_expired');end if;
 -- Failed attempts are persisted; raising an exception here would roll them back.
 update trust_private.guest_challenges set attempts=attempts+1 where id=c.id;
 if code_hash is null or code_hash is distinct from c.code_hash then return jsonb_build_object('ok',false,'error','invalid_or_expired');end if;
 if c.consumed_at is not null then return c.result;end if;
 select * into t from public.partnership_transactions where id=c.transaction_id for update;
 if t.sale_status not in('partnership_active','buyer_referred','negotiating') or not exists(select 1 from public.partnerships p where p.id=t.partnership_id and p.status='active' and p.deleted_at is null) then return jsonb_build_object('ok',false,'error','unavailable');end if;
 select * into a from public.partnership_agreements where id=t.agreement_id;
 if a.finalized_at is null or (a.terms->>'startsAt')::timestamptz>now() or ((a.terms->>'endsAt') is not null and (a.terms->>'endsAt')::timestamptz<=now()) then return jsonb_build_object('ok',false,'error','unavailable');end if;
 perform pg_advisory_xact_lock(hashtextextended(t.listing_id::text||c.identity_key,0));
 select * into r from public.buyer_referrals where listing_id=t.listing_id and identity_key=c.identity_key and expires_at>now() and status<>'expired' order by confirmed_at,id limit 1 for update;
 if found and r.partnership_id<>t.partnership_id then return jsonb_build_object('ok',false,'error','conflict');end if;
 if not found then
  insert into public.buyer_referrals(transaction_id,partnership_id,listing_id,identity_key,confirmation_method,expires_at)
   values(t.id,t.partnership_id,t.listing_id,c.identity_key,'verified_email',now()+make_interval(days=>(a.terms->>'attributionDays')::integer)) returning id into new_id;
  update public.partnership_transactions set sale_status=case when sale_status='partnership_active' then 'buyer_referred' else sale_status end,revision=revision+1,updated_at=now() where id=t.id;
  perform trust_private.event(null,t.id,'guest_buyer_referral_confirmed',jsonb_build_object('method','verified_email'),array[t.seller_id,t.partner_id]);
 else new_id:=r.id;end if;
 response_data:=jsonb_build_object('ok',true,'referralId',new_id);
 update trust_private.guest_challenges set consumed_at=now(),result=response_data where id=c.id;
 return response_data;
end $$;
create function public.trust_v1_guest_confirm(p_challenge_id uuid,p_code_hash text) returns jsonb language sql security invoker set search_path='' as $$select trust_private.guest_confirm(p_challenge_id,p_code_hash);$$;
revoke all on function trust_private.email_identity(text),trust_private.buyer_identity(uuid),trust_private.guest_begin(uuid,text,text,text,text,uuid),trust_private.guest_confirm(uuid,text),public.trust_v1_guest_begin(uuid,text,text,text,text,uuid),public.trust_v1_guest_confirm(uuid,text) from public,anon,authenticated;
grant execute on function trust_private.guest_begin(uuid,text,text,text,text,uuid),trust_private.guest_confirm(uuid,text),public.trust_v1_guest_begin(uuid,text,text,text,text,uuid),public.trust_v1_guest_confirm(uuid,text) to service_role;
commit;
