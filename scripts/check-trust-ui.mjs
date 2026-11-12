import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
import {createTrustDatabase,trustIds as ids} from './trust-database-fixture.mjs';

// Browser RPCs execute the real migrations in in-memory PostgreSQL. Every other
// Supabase request is mocked by mobileAuthFixture. No live users/data are touched.
const db=await createTrustDatabase();
const browserName=process.env.TRUST_TEST_BROWSER||'chromium';
const f=await mobileAuthFixture({authenticated:true,browserName});
let serial=0;const nonce=()=>`eeeeeeee-eeee-4eee-8eee-${String(++serial).padStart(12,'0')}`;
async function actor(user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');}
async function cmd(user,op,id,payload={},revision=null){await actor(user);return (await db.query('select public.trust_v1_command($1,$2,$3::jsonb,$4,$5) as r',[op,id,JSON.stringify(payload),nonce(),revision])).rows[0].r;}
let chain=Promise.resolve();const calls=[];let failReview=true;
await f.page.route(`${f.api}/rest/v1/rpc/trust_v1_*`,route=>{
 chain=chain.then(async()=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1),p=route.request().postDataJSON()||{};
  calls.push({name,p});
  if(name==='trust_v1_command'&&p.p_operation==='review'&&failReview){failReview=false;await route.fulfill({status:503,json:{message:'Synthetic transient outage'}});return;}
  try{
   await actor(ids.seller);let result;
   if(name==='trust_v1_capabilities')result=(await db.query('select public.trust_v1_capabilities() as r')).rows[0].r;
   else if(name==='trust_v1_dashboard')result=(await db.query('select public.trust_v1_dashboard($1,$2,$3) as r',[p.p_transaction_id,p.p_cursor_at,p.p_cursor_id])).rows[0].r;
   else if(name==='trust_v1_profile')result=(await db.query('select public.trust_v1_profile($1) as r',[p.p_user_id])).rows[0].r;
   else if(name==='trust_v1_command')result=(await db.query('select public.trust_v1_command($1,$2,$3::jsonb,$4,$5) as r',[p.p_operation,p.p_entity_id,JSON.stringify(p.p_payload),p.p_request_id,p.p_revision])).rows[0].r;
   else throw Error('Unexpected trust RPC '+name);
   await route.fulfill({status:200,json:result});
  }catch(e){await route.fulfill({status:400,json:{code:e.code,message:e.message}});}
 });return chain;
});
try{
 await mkdir('audit/trust-v1',{recursive:true});
 await f.go('/guven-merkezi');
 await f.page.getByText('Güven Sistemi hazırlanıyor',{exact:true}).waitFor();
 assert.equal(calls.filter(c=>c.name==='trust_v1_dashboard').length,0,'Disabled feature never queries transactions');
 await db.exec('reset role');await db.exec('update trust_private.settings set enabled=true');
 const terms={commissionType:'rate',commissionValue:5,attributionDays:30,dueDays:7,startsAt:new Date(Date.now()-60000).toISOString(),cancellation:'Synthetic cancellation terms only.',disputes:'Synthetic dispute terms only.'};
 const a=await cmd(ids.seller,'propose_agreement',ids.partnership,terms);
 await db.exec('reset role');const hash=(await db.query('select terms_hash from public.partnership_agreements where id=$1',[a.agreementId])).rows[0].terms_hash;
 await cmd(ids.seller,'accept_agreement',a.agreementId,{termsHash:hash});await cmd(ids.partner,'accept_agreement',a.agreementId,{termsHash:hash});
 const tx=await cmd(ids.seller,'create_transaction',a.agreementId);
 await f.go('/guven-merkezi?transaction='+tx.transactionId);
 await f.page.getByText('Satış süreci',{exact:true}).waitFor();
 await f.page.getByLabel('Satış tutarı',{exact:true}).fill('1500,00');
 await f.page.getByRole('button',{name:'Satış bildir',exact:true}).click();
 await f.page.getByText('Satış bildirildi',{exact:true}).first().waitFor();
 await f.page.getByRole('button',{name:'Satışın gerçekleştiğini doğrula',exact:true}).click();
 await f.page.getByText('Satış doğrulaması bekleniyor',{exact:true}).waitFor();
 await db.exec('reset role');let saved=(await db.query('select * from public.partnership_transactions where id=$1',[tx.transactionId])).rows[0];
 assert.equal(Number(saved.commission_amount),75);assert.equal(saved.commission_status,'under_review');
 const confirmed=await cmd(ids.partner,'confirm_sale',tx.transactionId,{},saved.revision);
 await f.go('/guven-merkezi?transaction='+tx.transactionId);
 await f.page.getByRole('button',{name:'Komisyon',exact:true}).click();
 await f.page.getByRole('button',{name:'Ödediğimi bildir',exact:true}).click();
 await f.page.getByText('Satıcı ödediğini bildirdi',{exact:true}).waitFor();
 await db.exec('reset role');saved=(await db.query('select * from public.partnership_transactions where id=$1',[tx.transactionId])).rows[0];assert.equal(saved.partner_payment_confirmed_at,null);
 await cmd(ids.partner,'confirm_payment',tx.transactionId,{},saved.revision);
 await f.go('/guven-merkezi?transaction='+tx.transactionId);
 await f.page.getByRole('button',{name:'Değerlendirme',exact:true}).click();
 for(const label of ['Alıcı yönlendirme kalitesi','İletişim','Doğru bilgilendirme','Anlaşmaya uyum'])await f.page.getByLabel(`${label}: 5 yıldız`,{exact:true}).click();
 await f.page.getByLabel('Deneyimin (isteğe bağlı)',{exact:true}).fill('Synthetic browser review.');
 await f.page.getByRole('button',{name:'Değerlendirmeyi gönder',exact:true}).click();
 await f.page.getByText('İşlem tamamlanamadı.',{exact:false}).waitFor();
 assert.equal(await f.page.getByLabel('Deneyimin (isteğe bağlı)',{exact:true}).inputValue(),'Synthetic browser review.');
 await f.page.getByRole('button',{name:'Değerlendirmeyi gönder',exact:true}).click();
 await f.page.getByText('İşlem kaydedildi.',{exact:true}).waitFor();
 const reviews=calls.filter(c=>c.p?.p_operation==='review');assert.equal(reviews.length,2);assert.equal(reviews[0].p.p_request_id,reviews[1].p.p_request_id,'Network retry keeps the same idempotency key');
 for(const width of [320,390,768,1440]){
  await f.page.setViewportSize({width,height:900});
  assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No horizontal overflow at ${width}`);
  await f.shot({path:`audit/trust-v1/${browserName}-transaction-${width}.png`,fullPage:true});
 }
 await f.go('/guven-profili?user='+ids.seller);await f.page.getByText('Henüz puan yok',{exact:true}).waitFor();
 await f.shot({path:`audit/trust-v1/${browserName}-profile-desktop.png`,fullPage:true});
 assert.equal(f.errors.length,0,JSON.stringify(f.errors));
 assert.equal(f.writes.filter(w=>!['ensure_my_profile'].includes(w.table)).length,0,'No unrelated writes');
 console.log('PASS: feature-off, real SQL RPC bridge, responsive transaction/sale/commission/review flow, private review, network retry idempotency, retained form, 320/390/768/1440 layouts. Synthetic local data only.');
}finally{await f.page.unrouteAll({behavior:'ignoreErrors'});await f.browser.close();await chain;await db.close();}
