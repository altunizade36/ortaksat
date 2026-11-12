import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
const sql=readFileSync('supabase/migrations/20261023082429_mobile_partner_activity.sql','utf8');
const [p]=await query("select id,partner_id from public.partnerships order by id limit 1");assert.ok(p,'Existing partnership required for isolated temporary-table trigger test');
const result=await query(`begin;${sql}
create temp table partner_history_fixture (like public.partnerships including defaults);
insert into partner_history_fixture select * from public.partnerships where id='${p.id}';
update partner_history_fixture set status='pending';
create temp table prior_event_count as select count(*) n from public.mobile_partner_events where partnership_id='${p.id}' and kind='rejected';
create trigger test_history after update of status on partner_history_fixture for each row execute function private.mobile_record_partner_event('partnership');
update partner_history_fixture set status='rejected' where id='${p.id}';
update partner_history_fixture set status='rejected' where id='${p.id}';
grant select on prior_event_count to authenticated;
select set_config('request.jwt.claims','${JSON.stringify({sub:p.partner_id,role:'authenticated'})}',true);set local role authenticated;
do $$ declare r jsonb;begin
 if (select count(*) from public.mobile_partner_events where partnership_id='${p.id}' and kind='rejected')<>(select n+1 from prior_event_count) then raise exception 'State transition not logged exactly once';end if;
 r:=public.mobile_partner_activity('rejected',0);if (r->>'total')::integer<1 then raise exception 'Own activity missing';end if;
 begin delete from public.mobile_partner_events where partnership_id='${p.id}';raise exception 'Client deleted immutable history';exception when insufficient_privilege then null;end;
end $$;reset role;
select set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',true);set local role authenticated;
do $$ begin
 if exists(select 1 from public.mobile_partner_events) or (public.mobile_partner_activity('all',0)->>'total')::integer<>0 then raise exception 'Foreign history leaked';end if;
end $$;reset role;
select jsonb_build_object('invoker',not (select prosecdef from pg_proc where oid='public.mobile_partner_activity(text,integer)'::regprocedure),'internalTrigger',not has_function_privilege('authenticated','private.mobile_record_partner_event()','execute'),'noAnon',not has_function_privilege('anon','public.mobile_partner_activity(text,integer)','execute')) as checks;rollback;`);
for(const[k,v]of Object.entries(result[0].checks))assert.equal(v,true,k);
console.log('Passed rollback event history: real trigger exercised on temporary copy only, one state transition, no duplicate unchanged event, own RLS, immutable client permissions, foreign-account isolation. Original partnership untouched.');
if(process.argv.includes('--apply')){await query(`begin;${sql}commit;`);console.log('Applied append-only partner history and paginated RPC.');}
