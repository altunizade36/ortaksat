import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
const sql=readFileSync('supabase/migrations/20261022094619_mobile_profile_details.sql','utf8');
const [a,b]=await query("select id from public.profiles where role='user' and status='active' order by id limit 2");assert.ok(a&&b,'Two non-staff identities required for rollback-only checks');
const exists=(await query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='username') as present"))[0].present;
const claims=id=>`select set_config('request.jwt.claims','${JSON.stringify({sub:id,role:'authenticated'})}',true);`;
const result=await query(`begin;${exists?'':sql}
${claims(a.id)}set local role authenticated;
update public.profiles set username='rollback_profile_test_778899',website_url='https://example.invalid',district_id=34028,instagram_handle='rollback_test' where id='${a.id}';
do $$begin if not exists(select 1 from public.get_my_profile() where username='rollback_profile_test_778899') then raise exception 'Own details not persisted';end if;end $$;
${claims(b.id)}
do $$ begin
 begin update public.profiles set username='rollback_profile_test_778899' where id='${b.id}';raise exception 'Duplicate username accepted';exception when unique_violation then null;end;
 begin update public.profiles set website_url='javascript:alert(1)' where id='${b.id}';raise exception 'Invalid website accepted';exception when check_violation then null;end;
 update public.profiles set username='cross_account_name' where id='${a.id}';if found then raise exception 'Cross-account profile changed';end if;
end $$;
reset role;
select jsonb_build_object('publicUsername',has_column_privilege('anon','public.profiles','username','select'),'privatePhone',not has_column_privilege('anon','public.profiles','phone','select')) as checks;rollback;`);
for(const[k,v]of Object.entries(result[0].checks))assert.equal(v,true,k);
console.log('Passed rollback profile checks: own persistence/readback, unique username, valid public website, cross-account update denial and private phone preserved.');
if(process.argv.includes('--apply')&&!exists){await query(`begin;${sql}commit;`);console.log('Applied public profile details schema.');}
