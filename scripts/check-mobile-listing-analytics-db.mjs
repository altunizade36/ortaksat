import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
const sql=readFileSync('supabase/migrations/20261023075728_mobile_listing_analytics.sql','utf8');
const [row]=await query("select id,owner_id from public.listings where status='active' and deleted_at is null order by id limit 1");assert.ok(row);
const result=await query(`begin;${sql}
insert into public.listing_views(listing_id,viewer_key,viewed_on) values('${row.id}','rollback-mobile-stats-check',(now() at time zone 'Europe/Istanbul')::date) on conflict do nothing;
select set_config('request.jwt.claims','${JSON.stringify({sub:row.owner_id,role:'authenticated'})}',true);set local role authenticated;
do $$ declare r jsonb;begin
 r:=public.mobile_listing_analytics('${row.id}',7);
 if r is null or (r->>'periodViews')::integer<1 then raise exception 'Owner statistics missing';end if;
 if jsonb_array_length(r->'series')<>7 or jsonb_array_length(public.mobile_listing_analytics('${row.id}',999)->'series')<>90 then raise exception 'Wrong date bounds';end if;
 begin perform viewer_key from public.listing_views;raise exception 'Viewer identifiers leaked';exception when insufficient_privilege then null;end;
end $$;reset role;
select set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',true);set local role authenticated;
do $$ begin
 if public.mobile_listing_analytics('${row.id}',30) is not null then raise exception 'Foreign owner statistics leaked';end if;
 if exists(select 1 from public.listing_views where listing_id='${row.id}') then raise exception 'Foreign daily views leaked';end if;
end $$;reset role;
select jsonb_build_object('invoker',not (select prosecdef from pg_proc where oid='public.mobile_listing_analytics(uuid,integer)'::regprocedure),'noAnon',not has_function_privilege('anon','public.mobile_listing_analytics(uuid,integer)','execute'),'categoryInvoker',not (select prosecdef from pg_proc where oid='public.mobile_seller_categories(uuid)'::regprocedure)) as checks;rollback;`);
for(const[k,v]of Object.entries(result[0].checks))assert.equal(v,true,k);
console.log('Passed rollback analytics: actual owner daily view, bounded 7/90-day series, other-account isolation, viewer identifiers inaccessible, invoker-only RPC.');
if(process.argv.includes('--apply')){await query(`begin;${sql}commit;`);console.log('Applied owner analytics and seller categories.');}
