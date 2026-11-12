import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
const sql=readFileSync('supabase/migrations/20261023162300_mobile_partner_override_validation.sql','utf8');
const result=await query(`begin;${sql}
create temp table override_fixture(like public.partnerships including defaults);
insert into override_fixture select * from public.partnerships order by id limit 1;
create trigger fixture_override_validation before update of commission_override_type,commission_override_value on override_fixture for each row execute function private.validate_mobile_partner_override();
do $$ begin
 if not exists(select 1 from override_fixture) then raise exception 'Partnership fixture required';end if;
 update override_fixture set commission_override_type='rate',commission_override_value=1.25;
 if not exists(select 1 from override_fixture where commission_override_value=1.25) then raise exception 'Decimal rate lost';end if;
 begin update override_fixture set commission_override_value=91;raise exception 'Rate above limit accepted';exception when invalid_parameter_value then null;end;
 begin update override_fixture set commission_override_value=-1;raise exception 'Negative value accepted';exception when invalid_parameter_value then null;end;
 begin update override_fixture set commission_override_value='NaN'::numeric;raise exception 'NaN accepted';exception when invalid_parameter_value then null;end;
 begin update override_fixture set commission_override_type=null;raise exception 'Partial override accepted';exception when invalid_parameter_value then null;end;
 update override_fixture set commission_override_type='fixed',commission_override_value=1250000;
 update override_fixture set commission_override_type=null,commission_override_value=null;
end $$;
select jsonb_build_object('invoker',not (select prosecdef from pg_proc where oid='private.validate_mobile_partner_override()'::regprocedure),'internalOnly',not has_function_privilege('authenticated','private.validate_mobile_partner_override()','execute')) as checks;rollback;`);
for(const[k,v]of Object.entries(result[0].checks))assert.equal(v,true,k);
console.log('Passed rollback override validation on temporary copy: decimal rate preserved, >90/negative/NaN/half-cleared pair rejected, fixed amount and clear accepted. Original records untouched.');
if(process.argv.includes('--apply')){await query(`begin;${sql}commit;`);console.log('Applied server override validation.');}
