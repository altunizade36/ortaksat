import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, go, api, listing, me, seller, errors } = await mobileAuthFixture({ authenticated: true });
const metro = process.env.NAVIGATION_METRO_URL;
if (metro) {
  const url = new URL(metro);
  if (!['localhost','127.0.0.1'].includes(url.hostname)) throw Error('Local Metro only');
  const response = await fetch(`${url.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);
  assert.ok(response.ok);
  const bundle = await response.text();
  await page.route('**/_expo/static/js/web/entry-*.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }));
  await page.route('**/assets/**', async route => { const u = new URL(route.request().url()); await route.fulfill({ response: await route.fetch({ url: url.origin + u.pathname + u.search }) }); });
}
const make = (n, title, fields = {}) => ({ ...listing, id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12,'0')}`, title, contact_method: 'message', currency: 'EUR', ...fields });
const rows = [make(1,'Mesaj tercihli test ilanı'), make(2,'WhatsApp tercihli test ilanı',{contact_method:'whatsapp'}), make(3,'Davetle katılım test ilanı',{partnership_mode:'invite'}), make(4,'Bekleyen talep test ilanı'), make(5,'Kapanmış ortaklık test ilanı',{status:'sold',stock_count:0,partnership_mode:'none'}), make(6,'Engelli ortaklık test ilanı'), make(7,'Stoksuz test ilanı',{stock_count:0}), make(8,'Kendi ilanım test örneği',{owner_id:me})];
const membership = (n,status) => ({ id: `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12,'0')}`, listing_id:rows[n-1].id,partner_id:me,status,ref_code:`sample-${n}`,note:'Yerel test başvurusu',created_at:'2026-10-26T00:00:00Z' });
let members = [membership(4,'pending'),membership(5,'active'),membership(6,'blocked')];
let phoneCalls = 0, releasePhone, startedPhone;
const phoneStarted = new Promise(resolve => { startedPhone = resolve; });
let failPhone = true, joinCalls = 0;
const joinBodies = [], findings = [];
await page.addInitScript(() => { window.__testExternalLinks = []; window.open = url => { window.__testExternalLinks.push(String(url)); return { closed:false, focus(){}, close(){} }; }; });
try {
 await page.route(`${api}/rest/v1/listing_public_cards**`, route => {
  const req=route.request(), id=new URL(req.url()).searchParams.get('id')?.replace('eq.',''); const found=id?rows.filter(r=>r.id===id):rows;
  return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?found[0]||null:found});
 });
 await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`, route => route.fulfill({json:{listings:rows,total:rows.length}}));
 await page.route(`${api}/rest/v1/partnerships**`, route => {
  const req=route.request(),id=new URL(req.url()).searchParams.get('id')?.replace('eq.',''); const found=id?members.filter(p=>p.id===id):members;
  return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?found[0]||null:found});
 });
 await page.route(`${api}/rest/v1/rpc/reveal_seller_phone`, async route => {
  phoneCalls++; if(failPhone){startedPhone();await new Promise(resolve=>{releasePhone=resolve;});await route.fulfill({status:503,json:{message:'Local phone lookup outage'}});}
  else await route.fulfill({json:'05550000000'});
 });
 await page.route(`${api}/rest/v1/rpc/partner_join`, async route => {
  joinCalls++;const body=route.request().postDataJSON();joinBodies.push(body);
  if(joinCalls===1){await route.fulfill({status:503,json:{message:'Local join outage'}});return;}
  const p={...membership(1,'pending'),id:body.p_partnership_id,note:body.p_note};members.push(p);
  await route.fulfill({json:[{r_id:p.id,r_status:'pending'}]});
 });
 await go('/kategoriler'); await page.getByRole('button',{name:'Emlak',exact:true}).click();
 async function open(n){await page.getByRole('button',{name:rows[n-1].title,exact:true}).click();await page.waitForURL(new RegExp(`/listing/${rows[n-1].id}`));}
 async function back(){await page.getByRole('button',{name:'Geri',exact:true}).first().click();await page.waitForURL(/\/kategori\/emlak/);}
 await open(1);
 assert.equal(await page.getByRole('button',{name:'Satıcıyı Ara',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Mesaj Gönder',exact:true}).isEnabled(),true);
 assert.equal(phoneCalls,0);await back();findings.push('Message-only seller does not expose phone action or fetch phone');
 await open(2);await page.getByRole('button',{name:'WhatsApp',exact:true}).click();await phoneStarted;
 assert.equal(await page.getByRole('button',{name:'Açılıyor…',exact:true}).isDisabled(),true);assert.equal(phoneCalls,1);
 releasePhone();await page.getByText('Telefon bilgisi alınamadı. Tekrar deneyebilir veya mesaj gönderebilirsin.',{exact:true}).waitFor();
 failPhone=false;await page.getByRole('button',{name:'WhatsApp',exact:true}).click();
 await page.waitForFunction(()=>window.__testExternalLinks.length===1);
 const links=await page.evaluate(()=>window.__testExternalLinks);assert.match(links[0],/^https:\/\/wa.me\/905550000000\?text=/);assert.equal(phoneCalls,2);await back();
 findings.push('WhatsApp preference, busy guard, lookup outage and retry; external navigation mocked');
 await open(3);const inviteButtons=page.getByRole('button',{name:'Davet gerekli',exact:true});assert.equal(await inviteButtons.count(),2);for(const b of await inviteButtons.all())assert.equal(await b.isDisabled(),true);await back();
 for(const [n,label] of [[4,'Talebim'],[5,'Ortaklığım']]){
  await open(n);await page.getByRole('button',{name:label,exact:true}).last().click();await page.waitForURL(new RegExp(`/partnership/${members.find(p=>p.listing_id===rows[n-1].id).id}`));
  await page.getByRole('button',{name:'Geri',exact:true}).first().click();await page.waitForURL(new RegExp(`/listing/${rows[n-1].id}`));await back();
 }
 findings.push('Invite-only action disabled; pending and closed-listing active memberships open their exact records');
 for(const [n,label] of [[6,'Ortaklık kapalı'],[7,'Tükendi']]) {await open(n);for(const b of await page.getByRole('button',{name:label,exact:true}).all())assert.equal(await b.isDisabled(),true);await back();}
 await open(8);assert.equal(await page.getByRole('button',{name:'İlanı Düzenle',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Mesaj Gönder',exact:true}).count(),0);await back();
 await open(1);await page.getByRole('button',{name:'Ortak Ol',exact:true}).last().click();await page.getByRole('heading',{name:'Ortaklık Talebi',exact:true}).waitFor();
 await page.getByRole('button',{name:'EUR Tutarı ile Teklif Et',exact:true}).waitFor();
 const amount=page.getByRole('textbox',{name:'Teklif Ettiğin Komisyon Tutarı',exact:true});const message=page.getByRole('textbox',{name:'Kendini ve ürünü nasıl tanıtacağını anlat...',exact:true});
 await amount.fill('0');await message.fill('Bu ürünü çevremdeki alıcılara önermek istiyorum.');
 await page.getByRole('button',{name:'Ortaklık Talebini Gönder',exact:true}).click();await page.getByText('Geçerli bir komisyon teklifi gir. Yüzde teklif 90 değerini aşamaz.',{exact:true}).waitFor();assert.equal(joinCalls,0);
 await amount.fill('750');await page.getByRole('button',{name:'Ortaklık Talebini Gönder',exact:true}).click();
 await page.getByText('Talep gönderilemedi. İlanın durumunu ve ortaklık koşullarını kontrol et.',{exact:true}).waitFor();assert.equal(await amount.inputValue(),'750');assert.match(await message.inputValue(),/çevremdeki/);
 await page.getByRole('button',{name:'Ortaklık Talebini Gönder',exact:true}).click();await page.getByText('Başvurun alındı',{exact:true}).waitFor();assert.equal(joinCalls,2);
 assert.ok(joinBodies[1].p_note.includes('Komisyon teklifim:'));assert.ok(joinBodies[1].p_note.includes('750'));
 await page.getByRole('button',{name:'Başvurunun Detayını Gör',exact:true}).click();await page.waitForURL(new RegExp(`/partnership/${joinBodies[1].p_partnership_id}`));
 findings.push('Owner/blocked/stock guards; proposal validation; failed submission preserves text; retry opens committed request');
 assert.deepEqual(errors,[]);
 await writeFile('audit/mobile-v4/listing-actions-ui.json',JSON.stringify({mockOnly:true,findings,phoneCalls,joinCalls,errors},null,2));
 console.log('Passed:',findings.join('; '));
}catch(error){console.error(page.url(),(await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:'audit/mobile-v4/listing-actions-failure.png'});throw error;}finally{await browser.close();}
