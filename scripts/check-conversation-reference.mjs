import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const engine=process.env.TRUST_TEST_BROWSER||'chromium',native=process.env.TEST_NATIVE==='1';
const f=await mobileAuthFixture({authenticated:true,browserName:engine});
const {page,browser,go,shot,api,listing,me,seller,errors}=f;
const output='audit/conversation-reference';await mkdir(output,{recursive:true});
const origin=new URL(process.env.MOBILE_TEST_URL||'http://localhost:8087').origin;
const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, PATCH, OPTIONS'};
const ids=[1,2,3,4].map(n=>`60000000-0000-4000-8000-00000000000${n}`);
const cids=ids.map((_,i)=>`70000000-0000-4000-8000-00000000000${i+1}`);
const rows=ids.map((id,i)=>({...listing,id,owner_id:i===2?me:seller,title:['Sohbet Telefonu','Sohbet Bilgisayarı','Kendi İlanım','Ortaklık İlanı'][i],currency:'EUR',price:1500,partnership_mode:'approval',commission_value:100,commission_due_days:7,attribution_window_days:30,partner_rules:['Ürünü doğru tanıtın.'],contact_method:'message',status:'active',stock_count:1}));
let closed=false,failCreate=true,failRespond=true;
const convs=cids.map((id,i)=>({id,listing_id:ids[i],seller_id:i===2?me:seller,buyer_id:i===2?seller:me,partner_id:i===3?me:null,participant_ids:[me,seller],status:'open',last_message_at:new Date(Date.now()-i*60000).toISOString(),created_at:new Date().toISOString()}));
const msgs=convs.map((c,i)=>({id:`80000000-0000-4000-8000-00000000000${i+1}`,conversation_id:c.id,listing_id:c.listing_id,sender_id:seller,receiver_id:me,body:'Merhaba, bu ilan için görüşebiliriz.',read:true,created_at:new Date(Date.now()-i*60000).toISOString()}));
let offers=[{id:'90000000-0000-4000-8000-000000000009',listing_id:ids[0],seller_id:seller,buyer_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',amount:99,status:'pending',created_at:new Date().toISOString()}];
const created=[],responses=[],checks=[];let contextReads=0;
const inbox=()=>page.getByTestId(native?'native-inbox':'web-inbox');
const items=()=>inbox().locator(native?'[data-testid="native-conversation-row"]:visible':'[data-vrow="1"]:visible');
async function boot(width){await page.setViewportSize({width,height:900});await go('/messages');await inbox().waitFor();await items().first().waitFor();}
async function openFirst(){await items().first().click();await page.getByTestId('conversation-listing-strip').waitFor();}
try{
 await page.route(`${api}/rest/v1/**`,async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').at(-1);
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let data;
  if(['listing_public_cards','search_listings'].includes(table)){if(u.searchParams.has('id')&&u.searchParams.get('id').startsWith('in.')){contextReads++;data=rows.filter(row=>u.searchParams.get('id').includes(row.id));}else data=u.searchParams.has('id')?rows:rows.slice(0,1);}
  if(table==='mobile_catalogue_page')return route.fulfill({headers,json:{listings:rows.slice(0,1),total:1}});
  if(table==='conversations')data=convs.map(c=>({...c,status:closed?'closed':'open'}));
  if(table==='messages'){if(req.method()!=='GET')return route.fulfill({headers,json:null});data=msgs;}
  if(table==='offers'){
   if(req.method()==='POST'){
    const body=req.postDataJSON();created.push(body);
    if(failCreate)return route.fulfill({status:503,headers,json:{message:'Local test outage'}});
    offers.push({...body,id:'90000000-0000-4000-8000-000000000001',status:'pending',created_at:new Date().toISOString()});return route.fulfill({headers,json:null});
   }data=offers;
  }
  if(table==='offer_buyer_action'||table==='offer_seller_respond'){
   const body=req.postDataJSON();responses.push(body);if(failRespond)return route.fulfill({status:503,headers,json:{message:'Local response outage'}});
   offers=offers.map(o=>o.id===body.p_offer_id?{...o,status:body.p_action==='accept_counter'?'accepted':body.p_action==='reject_counter'?'rejected':body.p_action,amount:body.p_action==='accept_counter'?o.counter_amount:o.amount}:o);return route.fulfill({headers,json:true});
  }
  if(data){if(u.searchParams.get('id')?.startsWith('eq.'))data=data.filter(r=>r.id===u.searchParams.get('id').slice(3));return route.fulfill({headers,json:req.headers().accept?.includes('vnd.pgrst.object')?data[0]??null:data});}
  return route.fallback();
 });
 for(const width of native?[390,900]:[390,1440]){
  await boot(width);await page.waitForFunction(()=>document.body.innerText.includes('Sohbet Bilgisayarı'));assert.equal(await items().count(),4);
  for(const [tab,count]of [['Alıcı',1],['Satıcı',2],['Ortaklık',1],['Tümü',4]]){await inbox().getByRole('button',{name:tab,exact:true}).click();assert.equal(await items().count(),count,tab);}
  const search=inbox().getByRole('textbox').first();await search.fill('Sohbet Bilgisayarı');assert.equal(await items().count(),1,'Listing-title search');await search.fill('');
  await shot({path:`${output}/${native?'native':'web'}-${engine}-${width}-inbox.png`});
  await openFirst();assert.match(await page.getByTestId('conversation-listing-strip').getAttribute('href'),new RegExp(ids[0]));
  assert.equal(await page.getByTestId('conversation-offer').count(),0,'Other buyer offer never shown');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot({path:`${output}/${native?'native':'web'}-${engine}-${width}.png`});checks.push({width,roles:true,listingAssociation:true,privateOffers:true});
 }
 await boot(native?390:1440);await openFirst();await page.getByRole('button',{name:'Teklif ver',exact:true}).click();
 await page.getByRole('textbox',{name:'Teklif tutarı',exact:true}).fill('1.200');await page.getByRole('textbox',{name:'Teklif notu',exact:true}).fill('Yerel örnek teklif notu.');
 await page.getByRole('button',{name:'Teklifi gönder',exact:true}).click();await page.getByText('Teklif gönderilemedi. Tekrar dene.',{exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Teklif tutarı',exact:true}).inputValue(),'1.200');
 failCreate=false;await page.getByRole('button',{name:'Teklifi gönder',exact:true}).click();await page.getByRole('button',{name:'Teklif penceresini kapat',exact:true}).waitFor({state:'hidden'});await page.getByTestId('conversation-offer').waitFor();
 assert.equal(created.at(-1).listing_id,ids[0]);assert.equal(created.at(-1).seller_id,seller);assert.equal(created.at(-1).buyer_id,me);assert.equal(created.at(-1).amount,1200);
 offers=offers.map(o=>o.buyer_id===me?{...o,status:'countered',counter_amount:1250}:o);
 await boot(native?390:1440);await openFirst();await page.getByRole('button',{name:'Teklifi kabul et',exact:true}).click();await page.getByText('Teklif güncellenemedi. Durumu kontrol edip tekrar dene.',{exact:true}).waitFor();
 assert.equal(offers.find(o=>o.buyer_id===me).status,'countered');failRespond=false;await page.getByRole('button',{name:'Teklifi kabul et',exact:true}).click();await page.getByTestId('conversation-offer').getByText('Teklif kabul edildi',{exact:true}).waitFor();
 assert.deepEqual(Object.keys(responses.at(-1)).sort(),['p_action','p_offer_id']);assert.equal(offers.find(o=>o.buyer_id===me).amount,1250);
 await shot({path:`${output}/${native?'native':'web'}-${engine}-accepted.png`});
 closed=true;await boot(native?390:1440);await openFirst();assert.equal(await page.getByRole('button',{name:'Teklif ver',exact:true}).isDisabled(),true);
 assert.ok(contextReads>0,'Off-catalogue conversation listing context fetched in batch');assert.deepEqual(errors,[]);await writeFile(`${output}/${native?'native':'web'}-${engine}.json`,JSON.stringify({engine,native,checks,createRequests:created.length,responseRequests:responses.length,contextReads,errors,localOnly:true},null,2));console.log('PASS reference conversations',native?'native':'web',engine,'roles, per-listing association, offer isolation, failed create retains fields, retry persists, failed counter response and server-authoritative acceptance; closed guards.');
}catch(error){console.error('URL',page.url(),(await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:`${output}/${native?'native':'web'}-${engine}-failure.png`});throw error;}finally{await browser.close();}
