import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const engine=process.env.TRUST_TEST_BROWSER||'chromium';const f=await mobileAuthFixture({authenticated:false,browserName:engine});
const {page,browser,go,shot,api,listing,listingId,errors}=f;const origin=new URL(process.env.MOBILE_TEST_URL||'http://localhost:8087').origin;
const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, PATCH, OPTIONS'};
const row={...listing,currency:'EUR',price:1500,commission_type:'fixed',commission_value:100,partnership_mode:'approval',commission_due_days:7,attribution_window_days:30,partner_rules:['Ürünü doğru tanıtın.'],contact_method:'message',description:'Ürün açıklaması ve teknik bilgileri. ',stock_count:1,status:'active'};
await mkdir('audit/listing-detail-design',{recursive:true});const checks=[];
try{
 await page.route(`${api}/rest/v1/listing_public_cards**`,route=>route.fulfill({headers,json:route.request().headers().accept?.includes('vnd.pgrst.object')?row:[row]}));
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await go(`/listing/${listingId}`);const terms=page.getByTestId('listing-terms-summary');await terms.waitFor();
  assert.ok((await terms.innerText()).includes('7 gün'));assert.ok((await terms.innerText()).includes('30 gün'));assert.equal(await terms.getByTestId('listing-terms-details').count(),0);
  await page.getByRole('button',{name:'Ortaklık koşullarını göster',exact:true}).click();await terms.getByText('• Ürünü doğru tanıtın.',{exact:true}).waitFor();await page.getByRole('button',{name:'Ortaklık koşullarını göster',exact:true}).click();
  assert.equal(await page.getByText('Ortak Satış Anlaşması',{exact:true}).count(),0,'No fictitious agreement before membership');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width<1024){const actions=page.getByTestId('listing-detail-actions');const box=await actions.boundingBox();assert.ok(box.height<=95,'Compact action bar');assert.equal(await actions.getByRole('button',{name:'Ortak Ol',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Ortak Ol',exact:true}).count(),1,'No repeated primary join button');}
  await shot({path:`audit/listing-detail-design/${engine}-${width}.png`});checks.push({width,overflow:false,realTerms:true,noPhantomAgreement:true});
 }
 assert.deepEqual(errors,[]);await writeFile(`audit/listing-detail-design/${engine}.json`,JSON.stringify({engine,checks,errors,localOnly:true},null,2));console.log('PASS detail design',engine,'compact actions, visible actual terms, no phantom agreement, 320/390/1440.');
}catch(error){console.error(page.url(),(await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:`audit/listing-detail-design/${engine}-failure.png`});throw error;}finally{await browser.close();}
