import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,appendFile,unlink,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createTrustDatabase,trustIds as ids} from './trust-database-fixture.mjs';

// Dedicated local PostgreSQL cluster, synthetic records only. No connection URL
// is accepted; this runner cannot accidentally point at a live database.
const root=resolve('audit/trust-v1'),run=join(tmpdir(),'ortaksat-trust-'+randomUUID()),data=join(run,'data');
// Windows PostgreSQL cannot initialise UTF-8 clusters beneath this workspace's
// non-ASCII path. Copy the reviewed binaries into this isolated ASCII temp path.
const source=resolve('audit/runtime/postgres/node_modules/@embedded-postgres/windows-x64/native');
const binaries=join(run,'native','bin');
await mkdir(run,{recursive:true});
await cp(source,join(run,'native'),{recursive:true});
const password=randomBytes(24).toString('hex'),pw=join(run,'initial-password');await writeFile(pw,password,{mode:0o600});
const port=await new Promise((res,rej)=>{const server=net.createServer();server.once('error',rej);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>res(port));});});
const options={host:'127.0.0.1',port,user:'postgres',password,database:'postgres',ssl:false};
const clients=[];let started=false;
function executable(name,args,timeout=60000){const r=spawnSync(join(binaries,name+'.exe'),args,{encoding:'utf8',windowsHide:true,timeout,...(name==='pg_ctl'?{stdio:'ignore'}:{})});if(r.error)throw r.error;if(r.status!==0)throw Error(`${name}: ${r.stderr||r.stdout||'process failed'}`);return r.stdout;}
async function connect(user){const client=new pg.Client(options);await client.connect();clients.push(client);if(user){await client.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await client.query('set role authenticated');}return client;}
async function command(client,op,id,payload={},revision=null,request=randomUUID()){return (await client.query('select public.trust_v1_command($1,$2,$3::jsonb,$4,$5) as r',[op,id,JSON.stringify(payload),request,revision])).rows[0].r;}
try{
 executable('initdb',['-D',data,'-U','postgres','--pwfile',pw,'--auth=scram-sha-256','--encoding=UTF8','--locale=C']);await unlink(pw);
 await appendFile(join(data,'postgresql.conf'),"\nlisten_addresses='127.0.0.1'\n");
 started=true;executable('pg_ctl',['-D',data,'-l',join(run,'postgres.log'),'-o',`-p ${port} -h 127.0.0.1`,'-w','-t','20','start']);
 const owner=await connect();await createTrustDatabase({exec:q=>owner.query(q),query:(q,p)=>owner.query(q,p)});await owner.query('update trust_private.settings set enabled=true');
 const seller=await connect(ids.seller),seller2=await connect(ids.seller),partner=await connect(ids.partner);
 const terms={commissionType:'rate',commissionValue:5,attributionDays:30,dueDays:7,startsAt:new Date(Date.now()-60000).toISOString(),cancellation:'Synthetic cancellation terms.',disputes:'Synthetic dispute terms with response rights.'};
 const a=await command(seller,'propose_agreement',ids.partnership,terms),hash=(await owner.query('select terms_hash from public.partnership_agreements where id=$1',[a.agreementId])).rows[0].terms_hash;
 await Promise.all([command(seller,'accept_agreement',a.agreementId,{termsHash:hash}),command(partner,'accept_agreement',a.agreementId,{termsHash:hash})]);
 const both=(await owner.query('select * from public.partnership_agreements where id=$1',[a.agreementId])).rows[0];assert.ok(both.finalized_at&&both.seller_accepted_at&&both.partner_accepted_at);
 const [first,second]=await Promise.all([command(seller,'create_transaction',a.agreementId),command(partner,'create_transaction',a.agreementId)]);assert.equal(first.transactionId,second.transactionId);
 let state=await command(seller,'report_sale',first.transactionId,{amount:'1500.00'},1);
 const confirmations=await Promise.allSettled([command(seller,'confirm_sale',first.transactionId,{},state.revision),command(partner,'confirm_sale',first.transactionId,{},state.revision)]);
 assert.equal(confirmations.filter(r=>r.status==='fulfilled').length,1);assert.equal(confirmations.find(r=>r.status==='rejected').reason.code,'40001');
 const current=confirmations.find(r=>r.status==='fulfilled').value;state=await command(confirmations[0].status==='fulfilled'?partner:seller,'confirm_sale',first.transactionId,{},current.revision);
 assert.equal(state.saleStatus,'sale_verified');assert.equal(Number((await owner.query('select count(*) as n from public.commissions')).rows[0].n),1);
 assert.equal((await owner.query('select stock_count from public.listings where id=$1',[ids.listing])).rows[0].stock_count,99);
 const paymentRequest=randomUUID(),declared=await Promise.all([command(seller,'declare_payment',first.transactionId,{},state.revision,paymentRequest),command(seller2,'declare_payment',first.transactionId,{},state.revision,paymentRequest)]);assert.deepEqual(declared[0],declared[1]);
 const partner2=await connect(ids.partner);const paid=await Promise.allSettled([command(partner,'confirm_payment',first.transactionId,{},declared[0].revision),command(partner2,'confirm_payment',first.transactionId,{},declared[0].revision)]);
 assert.equal(paid.filter(r=>r.status==='fulfilled').length,1);assert.equal(Number((await owner.query("select count(*) as n from public.activity_logs where action='trust_v1_confirm_payment'")).rows[0].n),1);
 assert.equal((await owner.query('select status from public.commissions')).rows[0].status,'paid');
 // Same authenticated buyer concurrently confirms competing partnerships.
 const p2=randomUUID();await owner.query("insert into public.partnerships(id,listing_id,partner_id,status,ref_code) values($1,$2,$3,'active','synthetic-code-2')",[p2,ids.listing,ids.outsider]);
 const other=await connect(ids.outsider),a2=await command(seller,'propose_agreement',p2,terms),hash2=(await owner.query('select terms_hash from public.partnership_agreements where id=$1',[a2.agreementId])).rows[0].terms_hash;
 await command(seller,'accept_agreement',a2.agreementId,{termsHash:hash2});await command(other,'accept_agreement',a2.agreementId,{termsHash:hash2});
 const ta=await command(seller,'create_transaction',a.agreementId),tb=await command(seller,'create_transaction',a2.agreementId),buyer=await connect(ids.buyer),buyer2=await connect(ids.buyer);
 const referrals=await Promise.allSettled([[buyer,ta,'synthetic-code'],[buyer2,tb,'synthetic-code-2']].map(async([client,t,code])=>(await client.query('select public.trust_v1_confirm_referral($1,$2,$3) as r',[t.transactionId,code,randomUUID()])).rows[0].r));
 assert.equal(referrals.filter(r=>r.status==='fulfilled').length,1);assert.match(referrals.find(r=>r.status==='rejected').reason.message,/TRUST_REFERRAL_CONFLICT/);
 assert.equal(Number((await owner.query('select count(*) as n from public.buyer_referrals')).rows[0].n),1);
 const receipt={passed:true,engine:(await owner.query('show server_version')).rows[0].server_version,connections:clients.length,checks:['simultaneous bilateral consent','single active file','stale revision race','single ledger/stock mutation','idempotent payment declaration','one mutual payment event','first valid competing referral'],remoteConnections:false};
 await writeFile(join(root,'concurrency-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{
 await Promise.allSettled(clients.map(c=>c.end()));
 if(started)executable('pg_ctl',['-D',data,'-w','-t','20','-m','fast','stop'],30000);
}
