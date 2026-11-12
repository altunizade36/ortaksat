import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
const sql=readFileSync('supabase/migrations/20261022091037_mobile_buyer_requests.sql','utf8');
async function query(query){const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_MGMT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}

const exists=(await query("select to_regclass('public.buyer_requests') is not null as present"))[0].present;
const ddl=exists?"":sql;
const [owned]=await query("select id,owner_id from public.listings where status='active' order by id limit 1");
const others=await query(`select id from public.profiles where id<>'${owned.owner_id}' and not public.is_blocked(id,'${owned.owner_id}') order by id limit 1`);
const identities=[{id:owned.owner_id},...others];
assert.equal(identities.length,2,'Two existing identities required for rollback-only authorization checks');
const a=identities[0].id,b=identities[1].id,id='99887766-5544-4433-8899-112233445566';
const claims=uid=>`select set_config('request.jwt.claims','${JSON.stringify({sub:uid,role:'authenticated'})}',true);`;
const checks=`select jsonb_build_object(
 'requestsRls',(select relrowsecurity from pg_class where oid='public.buyer_requests'::regclass),
 'offersRls',(select relrowsecurity from pg_class where oid='public.buyer_request_offers'::regclass),
 'noAnonWrite',not has_table_privilege('anon','public.buyer_requests','insert'),
 'noAnonOffers',not has_table_privilege('anon','public.buyer_request_offers','select'),
 'internalGuard',not has_function_privilege('authenticated','private.validate_mobile_buyer_offer()','execute'),
 'invokerCatalogue',not (select prosecdef from pg_proc where oid='public.mobile_catalogue_page(jsonb)'::regprocedure)
) as checks;`;
const r=await query(`begin; ${ddl}
${claims(a)} set local role authenticated;
insert into public.buyer_requests(id,user_id,title,description,category_trail,budget_min,budget_max,currency,expires_at) values('${id}','${a}','Rollback test request','Rollback-only authorization verification.',array['Elektronik'],100,1000,'TRY',now()+interval '1 day');
do $$ begin
 begin insert into public.buyer_requests(user_id,title,description,category_trail,budget_min,budget_max,expires_at) values('${b}','Denied owner test','Rollback-only authorization verification.',array['Elektronik'],100,1000,now()+interval '1 day'); raise exception 'Cross-account insert accepted'; exception when insufficient_privilege then null; end;
 begin update public.buyer_requests set budget_max=10 where id='${id}'; raise exception 'Invalid budget accepted'; exception when check_violation then null; end;
 begin update public.buyer_requests set expires_at=now()+interval '91 days' where id='${id}'; raise exception 'Invalid expiry accepted'; exception when invalid_parameter_value then null; end;
end $$;
${claims(b)}
do $$ begin
 if not exists(select 1 from public.buyer_requests where id='${id}') then raise exception 'Active request not visible'; end if;
 update public.buyer_requests set title='Changed by another account' where id='${id}';
 if found then raise exception 'Cross-account update accepted'; end if;
 delete from public.buyer_requests where id='${id}';
 if found then raise exception 'Cross-account delete accepted'; end if;
end $$;
${claims(a)} update public.buyer_requests set status='closed' where id='${id}';
${claims(b)}
do $$ begin if exists(select 1 from public.buyer_requests where id='${id}') then raise exception 'Closed foreign request visible'; end if; end $$;
insert into public.buyer_requests(id,user_id,title,description,category_trail,budget_min,budget_max,currency,expires_at) values('99887766-5544-4433-8899-112233445567','${b}','Offer rollback request','Rollback-only seller response verification.',array['Elektronik'],100,1000,'TRY',now()+interval '1 day');
do $$ begin
 begin insert into public.buyer_request_offers(request_id,seller_id,listing_id,note) values('99887766-5544-4433-8899-112233445567','${b}','${owned.id}','Denied foreign listing response.');raise exception 'Foreign listing offer accepted';exception when insufficient_privilege then null;end;
end $$;
${claims(a)}
insert into public.buyer_request_offers(id,request_id,seller_id,listing_id,note) values('99887766-5544-4433-8899-112233445568','99887766-5544-4433-8899-112233445567','${a}','${owned.id}','Rollback-only own listing response.');
${claims(b)}
do $$ begin
 if not exists(select 1 from public.buyer_request_offers where id='99887766-5544-4433-8899-112233445568') then raise exception 'Buyer cannot read received offer';end if;
 begin update public.buyer_request_offers set note='Attempt to alter seller content' where id='99887766-5544-4433-8899-112233445568';raise exception 'Offer content was altered';exception when invalid_parameter_value then null;end;
 update public.buyer_request_offers set status='accepted' where id='99887766-5544-4433-8899-112233445568';
 if not found then raise exception 'Buyer could not accept offer';end if;
end $$;
${claims(a)}
do $$ begin
 update public.buyer_request_offers set status='rejected' where id='99887766-5544-4433-8899-112233445568';if found then raise exception 'Seller could decide buyer offer';end if;
 delete from public.buyer_request_offers where id='99887766-5544-4433-8899-112233445568';if found then raise exception 'Seller deleted accepted offer';end if;
end $$;
${claims('99999999-9999-4999-8999-999999999999')}
do $$ begin if exists(select 1 from public.buyer_request_offers where id='99887766-5544-4433-8899-112233445568') then raise exception 'Third account read private offer';end if;end $$;
reset role; ${checks} rollback;`);
for(const[k,v]of Object.entries(r[0].checks))assert.equal(v,true,k);
console.log('Passed rollback checks: request visibility, cross-account insert/update/delete denied, invalid budgets/expiry denied, owner closure hidden, offers private, invoker catalogue. Seller can propose only own listing; buyer can accept, immutable content and third-account privacy verified.');
if(process.argv.includes('--apply')&&!exists){await query(`begin; ${sql} commit;`);const r=await query(checks);for(const[k,v]of Object.entries(r[0].checks))assert.equal(v,true,k);console.log('Applied and verified buyer request schema.');}
