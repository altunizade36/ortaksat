import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}

import { cases } from './check-listing-titles.mjs';
const migration='supabase/migrations/20261023164431_listing_title_policy.sql';
const sql=readFileSync(migration,'utf8');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
let tests='';
for (const [title,ok] of cases) {
  const insert=`insert into title_fixture(title) values (${quote(title)});`;
  tests+=ok?insert:`do $case$ begin begin ${insert} raise exception 'Invalid title accepted';exception when invalid_parameter_value then null;end;end $case$;`;
}
const result=await query(`begin;${sql}
create temp table title_fixture(title text);
create trigger fixture_title_policy before insert or update of title on title_fixture for each row execute function private.validate_listing_title();
${tests}
update title_fixture set title='  Temiz   iPhone 13 Pro  ';
do $$ begin if exists(select 1 from title_fixture where title<>'Temiz iPhone 13 Pro') then raise exception 'Normalization failed';end if;
begin update title_fixture set title='🔥 İlan başlığı';raise exception 'Invalid update accepted';exception when invalid_parameter_value then null;end;
end $$;
select jsonb_build_object('invoker',not (select prosecdef from pg_proc where oid='private.validate_listing_title()'::regprocedure),'internalOnly',not has_function_privilege('authenticated','private.validate_listing_title()','execute')) as checks;rollback;`);
for(const[k,v]of Object.entries(result[0].checks))assert.equal(v,true,k);
console.log(`Passed ${cases.length} server title cases, update rejection, normalization, trigger privileges. Rollback only; no listing changed.`);
if(process.argv.includes('--apply')){await query(`begin;${sql}commit;`);const r=await query("select exists(select 1 from pg_trigger where tgrelid='public.listings'::regclass and tgname='listing_title_policy' and not tgisinternal) as enabled");assert.equal(r[0].enabled,true);console.log('Applied and verified listing title server trigger.');}
