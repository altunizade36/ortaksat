begin;
alter table public.transaction_evidence add column scan_started_at timestamptz,add column scan_attempts integer not null default 0 check(scan_attempts between 0 and 3);
create function trust_private.begin_scan(evidence_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=trust_private.actor();e public.transaction_evidence;begin
 perform trust_private.require_enabled();
 if not(select scanner_ready from trust_private.settings where id) then raise exception 'TRUST_SCANNER_UNAVAILABLE';end if;
 select * into e from public.transaction_evidence where id=evidence_id for update;
 if not found or e.uploaded_by<>u then raise exception 'TRUST_FORBIDDEN' using errcode='42501';end if;
 if e.scan_status='clean' then return jsonb_build_object('alreadyScanned',true);end if;
 if e.scan_status<>'quarantined' or e.scan_attempts>=3 or e.scan_started_at>now()-interval '5 minutes' then raise exception 'TRUST_SCAN_BUSY';end if;
 if not exists(select 1 from storage.objects where bucket_id='trust-evidence' and name=e.storage_path) then raise exception 'TRUST_FILE_NOT_UPLOADED';end if;
 update public.transaction_evidence set scan_started_at=now(),scan_attempts=scan_attempts+1 where id=e.id;
 return to_jsonb(e);
end $$;
create function public.trust_v1_begin_scan(p_evidence_id uuid) returns jsonb language sql security invoker set search_path='' as $$select trust_private.begin_scan(p_evidence_id);$$;
revoke all on function trust_private.begin_scan(uuid),public.trust_v1_begin_scan(uuid) from public,anon,authenticated;
grant execute on function trust_private.begin_scan(uuid),public.trust_v1_begin_scan(uuid) to authenticated;
commit;
