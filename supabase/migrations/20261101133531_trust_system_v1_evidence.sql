begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('trust-evidence','trust-evidence',false,5242880,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
do $$begin
 if exists(select 1 from storage.buckets where id='trust-evidence' and (public or file_size_limit is null or file_size_limit>5242880)) then raise exception 'TRUST_UNSAFE_EXISTING_BUCKET';end if;
end $$;

create function trust_private.register_evidence(transaction_id uuid,kind text,mime text,bytes integer,request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=trust_private.actor();t public.partnership_transactions;new_id uuid:=gen_random_uuid();path text;result jsonb;previous trust_private.requests;fingerprint text;begin
 perform trust_private.require_enabled();
 if not(select scanner_ready from trust_private.settings where id) then raise exception 'TRUST_SCANNER_UNAVAILABLE';end if;
 if request is null or bytes is null or bytes not between 1 and 5242880 or mime not in('image/jpeg','image/png','application/pdf') or mime is null then raise exception 'TRUST_INVALID_FILE';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(kind,mime,bytes)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('trust_actor:'||u::text,0));
 perform pg_advisory_xact_lock(hashtextextended(u::text||request::text,0));
 select * into previous from trust_private.requests where actor_id=u and request_id=request;
 if found then
  if previous.operation<>'register_evidence' or previous.entity_id is distinct from transaction_id or previous.payload_hash<>fingerprint then raise exception 'TRUST_IDEMPOTENCY_CONFLICT';end if;
  return previous.result;
 end if;
 if (select count(*) from public.transaction_evidence where uploaded_by=u and created_at>now()-interval '1 day')>=50 then raise exception 'TRUST_RATE_LIMIT';end if;
 select * into t from public.partnership_transactions where id=transaction_id for update;
 if not found or not trust_private.member(t,u) then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
 if (select count(*) from public.transaction_evidence e where e.transaction_id=t.id and scan_status<>'deleted')>=20 then raise exception 'TRUST_EVIDENCE_LIMIT';end if;
 path:=t.id::text||'/'||new_id::text||case mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.pdf' end;
 insert into public.transaction_evidence(id,transaction_id,uploaded_by,kind,storage_path,mime_type,byte_size)
 values(new_id,t.id,u,kind,path,mime,bytes);
 result:=jsonb_build_object('evidenceId',new_id,'path',path,'bucket','trust-evidence','scanStatus','quarantined');
 insert into trust_private.requests(actor_id,request_id,operation,entity_id,result,payload_hash) values(u,request,'register_evidence',t.id,result,fingerprint);
 perform trust_private.event(u,t.id,'evidence_registered',jsonb_build_object('evidenceId',new_id,'kind',kind),array[t.seller_id,t.partner_id]);
 return result;
end $$;
create function public.trust_v1_register_evidence(p_transaction_id uuid,p_kind text,p_mime text,p_bytes integer,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select trust_private.register_evidence(p_transaction_id,p_kind,p_mime,p_bytes,p_request_id);$$;

create function trust_private.can_upload_evidence(path text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select s.enabled and s.scanner_ready from trust_private.settings s where id),false) and exists(
 select 1 from public.transaction_evidence e join public.profiles p on p.id=e.uploaded_by where e.storage_path=path and e.uploaded_by=auth.uid() and p.status='active' and e.scan_status='quarantined'
 );
$$;
create policy trust_registered_upload on storage.objects for insert to authenticated with check(bucket_id='trust-evidence' and trust_private.can_upload_evidence(name));
-- Restrictive policies prevent future broad storage policies from exposing quarantined files.
create policy trust_no_direct_download on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'trust-evidence');
create policy trust_no_overwrite on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'trust-evidence') with check(bucket_id<>'trust-evidence');
create policy trust_no_client_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'trust-evidence');

create function trust_private.evidence_for_scan(evidence_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform trust_private.require_enabled();
 select to_jsonb(e) into result from public.transaction_evidence e where e.id=evidence_id and e.scan_status='quarantined';
 if result is null then raise exception 'TRUST_EVIDENCE_NOT_PENDING';end if;
 return result;
end $$;
create function public.trust_v1_evidence_for_scan(p_evidence_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select trust_private.evidence_for_scan(p_evidence_id);$$;

create function trust_private.scan_result(evidence_id uuid,clean boolean,sha text,engine text,actual_bytes integer) returns void
language plpgsql security definer set search_path='' as $$
declare e public.transaction_evidence;begin
 perform trust_private.require_enabled();
 select * into e from public.transaction_evidence where id=evidence_id for update;
 if not found or e.scan_status<>'quarantined' then raise exception 'TRUST_EVIDENCE_NOT_PENDING';end if;
 if clean is null or sha !~ '^[a-f0-9]{64}$' or sha is null or length(coalesce(engine,'')) not between 1 and 120 then raise exception 'TRUST_INVALID_SCAN_RESULT';end if;
 if not exists(select 1 from storage.objects where bucket_id='trust-evidence' and name=e.storage_path) then raise exception 'TRUST_FILE_NOT_UPLOADED';end if;
 update public.transaction_evidence set scan_status=case when clean and actual_bytes=e.byte_size then 'clean' else 'rejected' end,
  content_hash=sha,scanner_version=engine,scanned_at=now() where id=e.id;
 perform trust_private.event(null,e.transaction_id,'evidence_scanned',jsonb_build_object('evidenceId',e.id,'clean',clean and actual_bytes=e.byte_size),'{}');
end $$;
create function public.trust_v1_scan_result(p_evidence_id uuid,p_clean boolean,p_sha text,p_engine text,p_bytes integer) returns void
language sql security invoker set search_path='' as $$select trust_private.scan_result(p_evidence_id,p_clean,p_sha,p_engine,p_bytes);$$;

create function trust_private.authorize_evidence(evidence_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=trust_private.read_actor();e public.transaction_evidence;t public.partnership_transactions;begin
 perform trust_private.require_enabled();
 select * into e from public.transaction_evidence where id=evidence_id;
 select * into t from public.partnership_transactions where id=e.transaction_id;
 if e.id is null or not coalesce(u in(t.seller_id,t.partner_id) or e.uploaded_by=u or trust_private.staff(u),false) or e.scan_status<>'clean' then raise exception 'TRUST_EVIDENCE_UNAVAILABLE' using errcode='42501';end if;
 perform trust_private.event(u,t.id,'evidence_accessed',jsonb_build_object('evidenceId',e.id),'{}');
 return jsonb_build_object('path',e.storage_path,'mime',e.mime_type,'bucket','trust-evidence','expiresIn',60);
end $$;
create function public.trust_v1_authorize_evidence(p_evidence_id uuid) returns jsonb language sql security invoker set search_path='' as $$select trust_private.authorize_evidence(p_evidence_id);$$;

create function trust_private.retention_candidates(batch_size integer default 100) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (
  select e.id,e.storage_path,e.transaction_id from public.transaction_evidence e where e.retention_until<now() and e.scan_status<>'deleted'
  and not exists(select 1 from public.trust_disputes d where d.transaction_id=e.transaction_id and d.status<>'resolved')
  order by e.retention_until,e.id limit greatest(1,least(batch_size,100))
 ) e;
$$;
create function public.trust_v1_retention_candidates(p_batch_size integer default 100) returns jsonb language sql stable security invoker set search_path='' as $$select trust_private.retention_candidates(p_batch_size);$$;

-- A client may already have INSERT permission for ordinary activity logs. Reserved trust
-- audit events must only be emitted by the privileged server functions, and never edited.
create function trust_private.guard_audit() returns trigger language plpgsql set search_path='' as $$
declare owner_name text;begin
 if tg_op in('UPDATE','DELETE') and old.action like 'trust_v1_%' then raise exception 'TRUST_AUDIT_IMMUTABLE';end if;
 if tg_op<>'DELETE' and new.action like 'trust_v1_%' then
  select pg_get_userbyid(p.proowner) into owner_name from pg_proc p where p.oid='trust_private.event(uuid,uuid,text,jsonb,uuid[])'::regprocedure;
  if current_user<>owner_name then raise exception 'TRUST_RESERVED_AUDIT_EVENT' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger trust_guard_audit before insert or update or delete on public.activity_logs for each row execute function trust_private.guard_audit();

revoke all on function trust_private.register_evidence(uuid,text,text,integer,uuid),trust_private.can_upload_evidence(text),trust_private.evidence_for_scan(uuid),trust_private.scan_result(uuid,boolean,text,text,integer),trust_private.authorize_evidence(uuid),trust_private.retention_candidates(integer),trust_private.guard_audit() from public,anon,authenticated;
grant execute on function trust_private.register_evidence(uuid,text,text,integer,uuid),trust_private.can_upload_evidence(text),trust_private.authorize_evidence(uuid) to authenticated;
grant execute on function trust_private.evidence_for_scan(uuid),trust_private.scan_result(uuid,boolean,text,text,integer),trust_private.retention_candidates(integer) to service_role;
revoke all on function public.trust_v1_register_evidence(uuid,text,text,integer,uuid),public.trust_v1_evidence_for_scan(uuid),public.trust_v1_scan_result(uuid,boolean,text,text,integer),public.trust_v1_authorize_evidence(uuid),public.trust_v1_retention_candidates(integer) from public,anon,authenticated;
grant execute on function public.trust_v1_register_evidence(uuid,text,text,integer,uuid),public.trust_v1_authorize_evidence(uuid) to authenticated;
grant execute on function public.trust_v1_evidence_for_scan(uuid),public.trust_v1_scan_result(uuid,boolean,text,text,integer),public.trust_v1_retention_candidates(integer) to service_role;
commit;
