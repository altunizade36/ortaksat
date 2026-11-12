import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const engine=process.env.TRUST_TEST_BROWSER||'chromium';
const f=await mobileAuthFixture({authenticated:true,browserName:engine});
const {page,browser,go,api,me,seller,listing,conversationId,shot,errors}=f;
const output='audit/messaging-reference';await mkdir(output,{recursive:true});
const second='55555555-5555-4555-8555-555555555555';
const listing2={...listing,id:'66666666-6666-4666-8666-666666666666',title:'MacBook Air M2',currency:'EUR',price:1200};
const now=new Date().toISOString();
const conversations=[conversationId,second].map((id,i)=>({id,listing_id:i?listing2.id:listing.id,seller_id:seller,buyer_id:me,participant_ids:[me,seller],status:'open',last_message_at:new Date(Date.now()-i*60000).toISOString(),created_at:now}));
const messages=conversations.flatMap((c,i)=>[{id:`10000000-0000-4000-8000-00000000000${i}`,conversation_id:c.id,listing_id:c.listing_id,sender_id:seller,receiver_id:me,body:i?'Bilgisayar için görüşebiliriz.':'Merhaba, ilan güncel. Hafta sonu görüşebiliriz.',read:true,created_at:now},{id:`20000000-0000-4000-8000-00000000000${i}`,conversation_id:c.id,listing_id:c.listing_id,sender_id:me,receiver_id:seller,body:'Teşekkürler, uygun saati paylaşır mısınız?',read:true,created_at:now}]);
const writes=[],checks=[];let closed=false;
const headers={'access-control-allow-origin':new URL(process.env.MOBILE_TEST_URL||'http://localhost:8087').origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, PATCH, OPTIONS'};
try {
 await page.route(`${api}/rest/v1/**`,async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').at(-1);
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let rows;
  if(['listing_public_cards','search_listings'].includes(table))rows=[listing,listing2];
  if(table==='conversations')rows=conversations.map(c=>({...c,status:closed?'closed':'open'}));
  if(table==='messages'){
   if(req.method()==='POST'){const row=req.postDataJSON();writes.push(row);messages.push({...row,read:false});return route.fulfill({headers,json:null});}
   if(req.method()==='PATCH'){const id=u.searchParams.get('conversation_id')?.replace('eq.','');for(const m of messages)if(m.conversation_id===id&&m.receiver_id===me)m.read=true;return route.fulfill({headers,json:null});}
   rows=messages;
  }
  if(rows){if(u.searchParams.get('id')?.startsWith('eq.'))rows=rows.filter(r=>r.id===u.searchParams.get('id').slice(3));const single=req.headers().accept?.includes('vnd.pgrst.object');return route.fulfill({headers,json:single?rows[0]??null:rows});}
  return route.fallback();
 });
 for(const width of [320,390,768,1024,1440]) {
  await page.setViewportSize({width,height:844});await go('/messages');
  const inbox=page.getByTestId('web-inbox');await inbox.waitFor();await inbox.locator('[data-vrow="1"]').first().waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: inbox overflow`);
  if(width>=1024) {
   const composer=page.getByTestId('message-composer');await composer.waitFor();
   await composer.fill('Birinci görüşmenin taslağı');
   await inbox.locator('[data-vrow="1"]').nth(1).click();assert.equal(await composer.inputValue(),'');
   await composer.fill('İkinci görüşmenin taslağı');await inbox.locator('[data-vrow="1"]').nth(0).click();assert.equal(await composer.inputValue(),'Birinci görüşmenin taslağı');
   const search=page.getByRole('textbox',{name:'Görüşmelerde ara',exact:true});await search.fill('eşleşmeyen-arama');await composer.waitFor({state:'hidden'});await search.fill('');await composer.waitFor();
   if(width===1440){assert.equal(await page.getByTestId('conversation-details').count(),1);await page.getByRole('button',{name:'İlan ayrıntıları',exact:true}).click();await page.getByTestId('conversation-details').waitFor({state:'hidden'});await page.getByRole('button',{name:'İlan ayrıntıları',exact:true}).click();await page.getByTestId('conversation-details').waitFor();}
   await composer.fill('Yerel örnek mesaj');await page.getByRole('button',{name:'Mesajı gönder',exact:true}).click();await page.waitForTimeout(500);assert.equal(writes.filter(w=>w.body==='Yerel örnek mesaj').length,checks.filter(c=>c.width>=1024).length+1);
  }else {
   await inbox.locator('[data-vrow="1"]').first().click();const chat=page.getByTestId('web-conversation');await chat.waitFor();const composer=page.getByTestId('message-composer');await composer.waitFor();
   assert.equal(await page.getByText('Ortaklık öner',{exact:true}).count(),0,'Replies initially collapsed');
   await page.getByRole('button',{name:'Hazır yanıtlar',exact:true}).click();await page.getByText('Ortaklık öner',{exact:true}).waitFor();await page.getByRole('button',{name:'Hazır yanıtlar',exact:true}).click();
   await page.getByRole('button',{name:'Sohbet seçenekleri',exact:true}).click();await page.getByRole('button',{name:'Kullanıcıyı bildir',exact:true}).waitFor();await page.getByRole('button',{name:'Sohbet seçenekleri',exact:true}).click();
   const c=await composer.boundingBox();assert.ok(c.height<=120&&c.y+c.height<=844,'Composer visible and bounded');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Chat no overflow');
  }
  await shot({path:`${output}/${engine}-${width}.png`});checks.push({width,overflow:false,compactChat:true});console.log('verified',engine,width);
 }
 for(const message of messages)if(message.receiver_id===me)message.read=false;
 await page.setViewportSize({width:1440,height:844});await go('/messages');await page.getByTestId('message-composer').waitFor();await page.getByRole('button',{name:'Okunmamış',exact:true}).click();await page.getByTestId('message-composer').waitFor({state:'hidden'});assert.equal(await page.getByTestId('web-inbox').locator('[data-vrow="1"]').count(),1,'Other unread conversation is not automatically opened');await page.getByTestId('web-inbox').locator('[data-vrow="1"]').first().click();await page.getByTestId('message-composer').waitFor();await page.waitForTimeout(200);assert.equal(await page.getByTestId('web-inbox').locator('[data-vrow="1"]').count(),0,'Read conversation leaves unread list');assert.equal(await page.getByTestId('message-composer').count(),1,'Explicit thread stays open after read');
 closed=true;await page.setViewportSize({width:390,height:844});await go('/messages');await page.getByTestId('web-inbox').locator('[data-vrow="1"]').first().click();await page.getByText('Bu konuşma kapatılmış. Mesaj geçmişini görüntüleyebilirsin.',{exact:true}).waitFor();assert.equal(await page.getByTestId('message-composer').count(),0);
 assert.deepEqual(errors,[]);await writeFile(`${output}/${engine}.json`,JSON.stringify({engine,checks,errors,localOnly:true,sentMessages:writes.length},null,2));console.log('PASS messaging design',engine,checks.length,'widths; draft isolation, empty filter, details/replies/options, local send.');
}catch(error){console.error('URL',page.url(),(await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:`${output}/${engine}-failure.png`});throw error;}finally{await browser.close();}
