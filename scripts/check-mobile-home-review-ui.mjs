import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const {browser,page,go,api,listing,errors}=await mobileAuthFixture({authenticated:true});
const metro=new URL(process.env.NAVIGATION_METRO_URL);
if(!['localhost','127.0.0.1'].includes(metro.hostname))throw Error('Local Metro only');
const response=await fetch(`${metro.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);assert.ok(response.ok);const bundle=await response.text();
await page.route('**/_expo/static/js/web/entry-*.js',r=>r.fulfill({contentType:'application/javascript',body:bundle}));
await page.route('**/assets/**',async r=>{const u=new URL(r.request().url());await r.fulfill({response:await r.fetch({url:metro.origin+u.pathname+u.search})});});
const rows=[{commission_type:'rate',commission_value:350},{commission_type:'fixed',commission_value:350,currency:'EUR'},{commission_type:'rate',commission_value:15}].map((fields,i)=>({...listing,id:`bbbbbbbb-bbbb-4bbb-8bbb-${String(i+1).padStart(12,'0')}`,title:`Uzun başlıklı mobil örnek ilan ${i+1} kaliteli ürün açıklaması`,...fields}));
try{
 await page.route(`${api}/rest/v1/listing_public_cards**`,r=>{
  const req=r.request(),id=new URL(req.url()).searchParams.get('id')?.replace('eq.','');const found=id?rows.filter(l=>l.id===id):rows;
  return r.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?found[0]||null:found});
 });
 await go('/kategoriler');await page.getByTestId('mobile-bottom-nav').getByRole('button',{name:'Ana Sayfa',exact:true}).click();
 const findings=[];
 for(const width of [320,390]){
  await page.setViewportSize({width,height:900});
  await page.waitForFunction(title=>{const el=[...document.querySelectorAll('[role="button"]')].find(e=>e.getAttribute('aria-label')===title);if(!el)return false;const r=el.getBoundingClientRect();return r.width>=(innerWidth-45)/2&&r.width<innerWidth/2;},rows[0].title);
  const cards=await Promise.all(rows.map(l=>page.getByRole('button',{name:l.title,exact:true}).boundingBox()));
  assert.ok(cards.every(Boolean));assert.ok(Math.abs(cards[0].y-cards[1].y)<2);assert.ok(cards[2].y>cards[0].y+cards[0].height);
  assert.ok(cards[0].width>=(width-45)/2);assert.ok(cards[1].x+cards[1].width<=width);
  await page.getByText('Komisyonu satıcıya sor',{exact:true}).first().waitFor();await page.getByText('Komisyon €350',{exact:true}).waitFor();
  assert.equal(await page.getByText('Komisyon %350',{exact:true}).count(),0);
  findings.push({width,cardWidth:cards[0].width,twoColumns:true});
 }
 await page.getByRole('button',{name:rows[0].title,exact:true}).click();
 const title=page.getByRole('heading',{name:rows[0].title,exact:true});await title.waitFor();assert.ok((await title.boundingBox()).width>=350);
 await page.getByText('Komisyonu satıcıya sor',{exact:true}).last().waitFor();await page.getByRole('button',{name:'Mesaj',exact:true}).waitFor();
 assert.equal(await page.getByText('Komisyon %350',{exact:true}).count(),0);
 await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);assert.deepEqual(errors,[]);
 await writeFile('audit/mobile-v4/home-emulator-review-ui.json',JSON.stringify({mockOnly:true,findings,invalidRateNotConvertedToMoney:true,detailTitleFullWidth:true,compactMessageButton:true,errors},null,2));
 console.log('Passed two-column phone cards, invalid-rate fallback, fixed EUR amount, full-width detail title and compact message action.');
}catch(error){console.error((await page.locator('body').innerText()).slice(-1400));throw error;}
finally{await browser.close();}
