import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
const sql=readFileSync('supabase/migrations/20261022093059_mobile_partner_performance.sql','utf8');
const result=await query(`begin;${sql}
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',true);
do $$ declare r jsonb;begin
 r:=public.mobile_partner_performance(30);
 if (r->>'clicks')::integer<>0 or (r->>'active')::integer<>0 or (r->>'listingCount')::integer<>0 then raise exception 'Foreign account data leaked'; end if;
 if jsonb_array_length(r->'clickSeries')<>30 then raise exception 'Wrong chart period';end if;
 if jsonb_array_length(public.mobile_partner_performance(999)->'clickSeries')<>90 then raise exception 'Unbounded period';end if;
end $$;reset role;
select jsonb_build_object('invoker',not (select prosecdef from pg_proc where oid='public.mobile_partner_performance(integer)'::regprocedure),'noAnon',not has_function_privilege('anon','public.mobile_partner_performance(integer)','execute')) as checks;
rollback;`);
for(const[k,v]of Object.entries(result[0].checks))assert.equal(v,true,k);
console.log('Passed rollback performance RPC: own-account isolation, complete 30-day series, bounded period, invoker permissions and no anonymous access.');
if(process.argv.includes('--apply')){await query(`begin;${sql}commit;`);console.log('Applied partner performance RPC.');}
