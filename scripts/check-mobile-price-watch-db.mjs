import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
const sql=readFileSync('supabase/migrations/20261023081519_mobile_price_watch_preferences.sql','utf8');
const [row]=await query("select id from public.profiles order by id limit 1");assert.ok(row);
const result=await query(`begin;${sql}
select set_config('request.jwt.claims','${JSON.stringify({sub:row.id,role:'authenticated'})}',true);
update public.profiles set preferences=coalesce(preferences,'{}'::jsonb)||'{"notify_all_off":false,"notify_listings":true,"notify_type_price_drop":true,"notify_price_drop_skip:99999999-9999-4999-8999-999999999999":true}'::jsonb where id='${row.id}';
do $$ declare n integer;begin
 insert into public.notifications(user_id,type,title,body,metadata) values('${row.id}','price_drop','ROLLBACK TEST','Muted before all delivery triggers','{"listingId":"99999999-9999-4999-8999-999999999999"}');
 get diagnostics n=row_count;if n<>0 then raise exception 'Muted price alert was inserted';end if;
end $$;
select jsonb_build_object('internalOnly',not has_function_privilege('authenticated','private.mobile_notification_preference_guard()','execute'),'globalStillOff',not public.mobile_notification_enabled('{"notify_all_off":true}','price_drop')) as checks;rollback;`);
for(const[k,v]of Object.entries(result[0].checks))assert.equal(v,true,k);
console.log('Passed rollback price watch: muted listing drops notification before delivery, global mute preserved, private trigger not client executable. No notification sent.');
if(process.argv.includes('--apply')){await query(`begin;${sql}commit;`);console.log('Applied per-listing price watch preference guard.');}
