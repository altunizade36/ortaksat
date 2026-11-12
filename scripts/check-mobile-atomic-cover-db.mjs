import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
const sql=readFileSync('supabase/migrations/20261022092415_mobile_atomic_listing_cover.sql','utf8');
const [row]=await query("select id,owner_id from public.listings where status='active' order by id limit 1");
assert.ok(row,'Existing listing required for rollback-only transaction test');
const exists=(await query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='listings' and column_name='cover_image_url') as present"))[0].present;
const checks=`select jsonb_build_object('invoker',not (select prosecdef from pg_proc where oid='private.sync_mobile_listing_cover()'::regprocedure),'notCallable',not has_function_privilege('authenticated','private.sync_mobile_listing_cover()','execute')) as checks;`;
const result=await query(`begin; ${exists?'':sql}
create function private.test_cover_failure() returns trigger language plpgsql as $$begin if new.url like '%atomic-fail%' then raise exception 'Rollback test' using errcode='23514'; end if;return new;end $$;
create trigger test_cover_failure before insert on public.listing_images for each row execute function private.test_cover_failure();
select set_config('request.jwt.claims','${JSON.stringify({sub:row.owner_id,role:'authenticated'})}',true);set local role authenticated;
update public.listings set cover_image_url='https://example.invalid/rollback-cover.jpg' where id='${row.id}';
do $$ declare prior_title text;begin
 if not exists(select 1 from public.listing_images where listing_id='${row.id}' and sort_order=0 and url='https://example.invalid/rollback-cover.jpg') then raise exception 'Cover not written'; end if;
 select title into prior_title from public.listings where id='${row.id}';
 begin update public.listings set title=title||' rollback-test',cover_image_url='https://example.invalid/atomic-fail.jpg' where id='${row.id}'; raise exception 'Image failure did not reject';exception when check_violation then null;end;
 if exists(select 1 from public.listings where id='${row.id}' and (title<>prior_title or cover_image_url<>'https://example.invalid/rollback-cover.jpg')) then raise exception 'Listing not rolled back';end if;
 if not exists(select 1 from public.listing_images where listing_id='${row.id}' and sort_order=0 and url='https://example.invalid/rollback-cover.jpg') then raise exception 'Old cover lost';end if;
 begin update public.listings set cover_image_url='file:///local-photo.jpg' where id='${row.id}';raise exception 'Local URI accepted';exception when check_violation then null;end;
end $$;
reset role;${checks} rollback;`);
for(const[k,v]of Object.entries(result[0].checks))assert.equal(v,true,k);
console.log('Passed rollback transaction test: cover synchronization, image failure rolls back listing fields and preserves previous cover, device-only URI rejected, invoker privileges.');
if(process.argv.includes('--apply')&&!exists){await query(`begin; ${sql} commit;`);console.log('Applied atomic listing cover schema.');}
