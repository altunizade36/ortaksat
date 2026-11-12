import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
const sql=readFileSync('supabase/migrations/20261022142958_mobile_block_reason.sql','utf8');
const [l]=await query("select id,owner_id from public.listings where status='active' and partnership_mode in ('open','approval') order by id limit 1");
const [b]=await query(`select id from public.profiles where id<>'${l.owner_id}' and status='active' and role='user' and not public.is_blocked(id,'${l.owner_id}') and not exists(select 1 from public.partnerships where listing_id='${l.id}' and partner_id=profiles.id) limit 1`);assert.ok(b);
const exists=(await query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocked_users' and column_name='reason') as present"))[0].present;
const claims=id=>`select set_config('request.jwt.claims','${JSON.stringify({sub:id,role:'authenticated'})}',true);`;
const result=await query(`begin;${exists?'':sql}
${claims(b.id)}set local role authenticated;
insert into public.blocked_users(blocker_id,blocked_id,reason) values('${b.id}','${l.owner_id}','Rahatsız edici mesajlar');
do $$ begin
 if not public.is_blocked('${b.id}','${l.owner_id}') then raise exception 'Block not registered';end if;
 begin perform public.partner_join('99887766-5544-4433-8899-112233445599','${l.id}','rollback_block',null,'','','','',0);raise exception 'Blocked partnership accepted';exception when insufficient_privilege then null;end;
 begin insert into public.follows(follower_id,seller_id) values('${b.id}','${l.owner_id}');raise exception 'Blocked follow accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;select jsonb_build_object('invoker',not (select prosecdef from pg_proc where oid='private.mobile_blocked_partnership()'::regprocedure),'notCallable',not has_function_privilege('authenticated','private.mobile_blocked_partnership()','execute')) as checks;rollback;`);
for(const[k,v]of Object.entries(result[0].checks))assert.equal(v,true,k);
console.log('Passed rollback blocking: reason saved, bidirectional block recognized, blocked partner RPC and follow denied, invoker/non-callable guard.');
if(process.argv.includes('--apply')&&!exists){await query(`begin;${sql}commit;`);console.log('Applied blocking reason and server guards.');}
