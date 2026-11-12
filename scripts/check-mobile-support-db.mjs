import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
const sql=readFileSync('supabase/migrations/20261021173622_mobile_support_evidence.sql','utf8');
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
const checks=`select jsonb_build_object(
 'rls',(select relrowsecurity from pg_class where oid='public.support_messages'::regclass),
 'anon',has_table_privilege('anon','public.support_messages','select'),
 'privateBucket',(select not public and file_size_limit=5242880 from storage.buckets where id='private-evidence'),
 'definerNotCallable',not has_function_privilege('authenticated','private.mobile_support_message_received()','execute'),
 'messagePolicies',(select count(*)=2 from pg_policies where schemaname='public' and tablename='support_messages'),
 'ownRead',position('user_id' in (select qual from pg_policies where schemaname='public' and tablename='support_messages' and policyname='ticket participants read messages'))>0
) as checks;`;
const result=await query(`begin; ${sql}
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',true);
select public.validate_mobile_evidence(array['99999999-9999-4999-8999-999999999999/aaaa-bbbb.jpg'],'99999999-9999-4999-8999-999999999999');
do $$ begin
 begin perform public.validate_mobile_evidence(array['11111111-1111-4111-8111-111111111111/aaaa.jpg'],'99999999-9999-4999-8999-999999999999'); raise exception 'Cross-account path accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.validate_mobile_evidence(array_fill('99999999-9999-4999-8999-999999999999/aaaa.jpg'::text,array[6]),'99999999-9999-4999-8999-999999999999'); raise exception 'Six attachments accepted'; exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.support_messages) then raise exception 'Unknown account read another ticket'; end if;
end $$;
reset role; ${checks} rollback;`);
for(const [key,value] of Object.entries(result[0].checks))assert.equal(value,key==='anon'?false:true,key);
console.log('Passed rollback DDL: private bucket, 5-file bound, cross-account paths denied, RLS participant reads, no anonymous access, internal trigger not directly executable.');
if(process.argv.includes('--apply')){await query(`begin; ${sql} commit;`);const applied=await query(checks);for(const [key,value]of Object.entries(applied[0].checks))assert.equal(value,key==='anon'?false:true,key);console.log('Applied and verified support/evidence schema.');}
