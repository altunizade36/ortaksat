begin;
create table trust_private.restrictions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 dispute_id uuid not null references public.trust_disputes(id),reason text not null check(length(reason) between 10 and 2000),
 imposed_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),expires_at timestamptz not null,
 lifted_at timestamptz,lifted_by uuid references public.profiles(id),lift_reason text,
 check(expires_at>created_at),check((lifted_at is null)=(lifted_by is null))
);
create table trust_private.notification_keys(key text primary key,created_at timestamptz not null default now());
revoke all on trust_private.restrictions,trust_private.notification_keys from public,anon,authenticated;

create function trust_private.restricted(u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from trust_private.restrictions where user_id=u and lifted_at is null and expires_at>now());
$$;
create function trust_private.staff_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=trust_private.read_actor();begin
 perform trust_private.require_enabled();
 if not trust_private.staff(u) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
 return jsonb_build_object('disputes',coalesce((select jsonb_agg(to_jsonb(d)) from (select d.*,t.revision from public.trust_disputes d join public.partnership_transactions t on t.id=d.transaction_id order by (d.status='resolved'),d.created_at limit 100) d),'[]'::jsonb),
 'restrictions',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from trust_private.restrictions order by created_at desc limit 100) r),'[]'::jsonb));
end $$;
create function public.trust_v1_staff_queue() returns jsonb language sql stable security invoker set search_path='' as $$select trust_private.staff_queue();$$;

create function trust_private.restrict_partnership(user_id uuid,dispute_id uuid,reason text,days integer,request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=trust_private.actor();d public.trust_disputes;t public.partnership_transactions;new_id uuid;old_request trust_private.requests;fingerprint text;begin
 perform trust_private.require_enabled();
 if not trust_private.staff(u) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
 if request is null or length(coalesce(reason,'')) not between 10 and 2000 or days is null or days not between 1 and 365 then raise exception 'TRUST_INVALID_RESTRICTION';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(user_id,dispute_id,reason,days)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('trust_actor:'||u::text,0));
 select * into old_request from trust_private.requests where actor_id=u and request_id=request;
 if found then
  if old_request.operation<>'restrict_partnership' or old_request.payload_hash<>fingerprint then raise exception 'TRUST_IDEMPOTENCY_CONFLICT';end if;
  return (old_request.result->>'restrictionId')::uuid;
 end if;
 select * into d from public.trust_disputes where id=dispute_id;
 select * into t from public.partnership_transactions where id=d.transaction_id;
 if d.id is null or d.status<>'resolved' or d.outcome<>'upheld' or not coalesce(user_id in(t.seller_id,t.partner_id),false) then raise exception 'TRUST_RESOLVED_CASE_REQUIRED';end if;
 insert into trust_private.restrictions(user_id,dispute_id,reason,imposed_by,expires_at) values(user_id,d.id,reason,u,now()+make_interval(days=>days)) returning id into new_id;
 insert into trust_private.requests(actor_id,request_id,operation,entity_id,payload_hash,result) values(u,request,'restrict_partnership',user_id,fingerprint,jsonb_build_object('restrictionId',new_id));
 perform trust_private.event(u,t.id,'restriction_imposed',jsonb_build_object('restrictionId',new_id,'reason',reason,'expiresAt',now()+make_interval(days=>days)),array[user_id]);
 return new_id;
end $$;
create function public.trust_v1_restrict_partnership(p_user_id uuid,p_dispute_id uuid,p_reason text,p_days integer,p_request_id uuid) returns uuid language sql security invoker set search_path='' as $$select trust_private.restrict_partnership(p_user_id,p_dispute_id,p_reason,p_days,p_request_id);$$;

create function trust_private.lift_restriction(restriction_id uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=trust_private.actor();r trust_private.restrictions;begin
 perform trust_private.require_enabled();
 if not trust_private.staff(u) or length(coalesce(reason,'')) not between 10 and 2000 then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
 select * into r from trust_private.restrictions where id=restriction_id for update;
 if not found then raise exception 'TRUST_RESTRICTION_NOT_FOUND';end if;
 if r.lifted_at is not null then return;end if;
 update trust_private.restrictions set lifted_at=now(),lifted_by=u,lift_reason=lift_restriction.reason where id=r.id;
 perform trust_private.event(u,(select transaction_id from public.trust_disputes where id=r.dispute_id),'restriction_lifted',jsonb_build_object('restrictionId',r.id,'reason',reason),array[r.user_id]);
end $$;
create function public.trust_v1_lift_restriction(p_restriction_id uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select trust_private.lift_restriction(p_restriction_id,p_reason);$$;

-- Called by a protected scheduler, never by clients. Durable business keys prevent repeats.
create function trust_private.reminders() returns integer language plpgsql security definer set search_path='' as $$
declare t public.partnership_transactions;k text;sent integer:=0;begin
 perform trust_private.require_enabled();
 for t in select * from public.partnership_transactions where due_at<=now() and commission_status in('earned','awaiting_payment') order by due_at limit 1000 loop
  k:='due:'||t.id::text||':'||t.due_at::text;
  insert into trust_private.notification_keys(key) values(k) on conflict do nothing;
  if found then perform trust_private.event(null,t.id,'commission_due',jsonb_build_object('dueAt',t.due_at),array[t.seller_id,t.partner_id]);sent:=sent+1;end if;
 end loop;
 for t in select * from public.partnership_transactions where sale_verified_at is not null and now()<sale_verified_at+interval '14 days' order by sale_verified_at limit 1000 loop
  k:='review:'||t.id::text;
  insert into trust_private.notification_keys(key) values(k) on conflict do nothing;
  if found then perform trust_private.event(null,t.id,'review_requested',jsonb_build_object('deadline',t.sale_verified_at+interval '14 days'),array[t.seller_id,t.partner_id,t.buyer_id]);sent:=sent+1;end if;
 end loop;
 return sent;
end $$;
create function public.trust_v1_send_reminders() returns integer language sql security invoker set search_path='' as $$select trust_private.reminders();$$;
revoke all on function trust_private.restricted(uuid),trust_private.staff_queue(),trust_private.restrict_partnership(uuid,uuid,text,integer,uuid),trust_private.lift_restriction(uuid,text),trust_private.reminders() from public,anon,authenticated;
grant execute on function trust_private.staff_queue(),trust_private.restrict_partnership(uuid,uuid,text,integer,uuid),trust_private.lift_restriction(uuid,text) to authenticated;
grant execute on function trust_private.reminders() to service_role;
revoke all on function public.trust_v1_staff_queue(),public.trust_v1_restrict_partnership(uuid,uuid,text,integer,uuid),public.trust_v1_lift_restriction(uuid,text),public.trust_v1_send_reminders() from public,anon,authenticated;
grant execute on function public.trust_v1_staff_queue(),public.trust_v1_restrict_partnership(uuid,uuid,text,integer,uuid),public.trust_v1_lift_restriction(uuid,text) to authenticated;
grant execute on function public.trust_v1_send_reminders() to service_role;
create function trust_private.guard_notification() returns trigger language plpgsql set search_path='' as $$
declare owner_name text;begin
 if new.metadata ? 'trust_event' and (tg_op='INSERT' or new.metadata is distinct from old.metadata) then
  select pg_get_userbyid(p.proowner) into owner_name from pg_proc p where p.oid='trust_private.event(uuid,uuid,text,jsonb,uuid[])'::regprocedure;
  if current_user<>owner_name then raise exception 'TRUST_RESERVED_NOTIFICATION' using errcode='42501';end if;
 end if;
 return new;
end $$;
create trigger trust_guard_notification before insert or update on public.notifications for each row execute function trust_private.guard_notification();
revoke all on function trust_private.guard_notification() from public,anon,authenticated;
commit;
