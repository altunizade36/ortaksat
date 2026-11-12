import assert from 'node:assert/strict';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const f=await mobileAuthFixture({browserName:process.env.TEST_BROWSER||'chromium',authenticated:process.env.TEST_AUTH==='1'});
const {page,browser,go,api,listing,errors}=f;
let calls=[];const network=[];
page.on('request',r=>{if(r.url().includes(new URL(api).hostname))network.push({method:r.method(),path:new URL(r.url()).pathname});});
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
await page.route(`${api}/**`,async route=>{
 const request=route.request(),table=new URL(request.url()).pathname.split('/').at(-1);
 if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
 if(request.method()==='GET'&&['listing_public_cards','profiles'].includes(table))return route.fulfill({json:table==='profiles'?[]:[listing],headers:cors});
 return route.fallback();
});
await page.route(url=>url.origin===new URL(api).origin&&url.pathname==='/rest/v1/rpc/mobile_catalogue_page',async route=>{
 if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
 const params=route.request().postDataJSON().params;calls.push(params);
 await route.fulfill({headers:cors,json:{listings:Array.from({length:6},(_,i)=>({...listing,id:`33333333-3333-4333-8333-${String(i+1).padStart(12,'0')}`,title:`BMW 320i test ilanı ${i+1}`,commission_type:'rate',commission_value:5})),total:6}});
});
try {
 for(const width of [1440,1024,390,320]) {
  await page.setViewportSize({width,height:1100});await go('/partner');
  const desktop=width>=1000;
  const layout=page.getByTestId('partnership-web-layout');
  if(desktop) {
   await layout.waitFor();
   assert.equal(await page.getByRole('heading',{name:'Ortaklık fırsatları',exact:true}).count(),1);
   assert.equal(await page.getByText('Ortak Satış Fırsatları',{exact:true}).count(),0);
   assert.equal(await page.getByTestId('partnership-web-categories').count(),1);
   const input=page.getByRole('textbox',{name:'Ortaklık ilanlarında ara',exact:true});
   for(let n=0;n<400&&!calls.length;n++)await page.waitForTimeout(50);
   await input.fill('');await input.pressSequentially('Temiz BMW',{delay:30});
   for(let n=0;n<100&&!calls.some(x=>x.q==='Temiz BMW');n++)await page.waitForTimeout(50);
   assert.ok(calls.some(x=>x.q==='Temiz BMW'));
   await page.getByRole('button',{name:'Yüksek Komisyon',exact:true}).click();
   for(let n=0;n<30&&!calls.some(x=>x.sort==='commission');n++)await page.waitForTimeout(50);
   assert.ok(calls.some(x=>x.sort==='commission'));
   await page.getByRole('button',{name:'Ortaklık kategorisi: Emlak',exact:true}).click();
   for(let n=0;n<30&&!calls.some(x=>x.root==='Emlak');n++)await page.waitForTimeout(50);
   assert.ok(calls.some(x=>x.root==='Emlak'));
   await page.getByRole('tab',{name:'Talepler',exact:true}).click();
   await page.getByRole('heading',{name:'Ortaklık talepleri',exact:true}).waitFor();
   await page.getByRole('tab',{name:'Fırsatları keşfet',exact:true}).click();
  } else {
   assert.equal(await layout.count(),0);
   await page.getByRole('heading',{name:'Ortaklık fırsatları',exact:true}).waitFor();
   assert.equal(await page.getByText('Ortak Satış Fırsatları',{exact:true}).count(),0);
  }
  const grid=page.getByTestId('partnership-results-grid');await grid.locator(':scope > div').first().waitFor();
  const cards=await grid.locator(':scope > div').evaluateAll(els=>els.slice(0,3).map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width};}));
  assert.equal(cards.length,3);
  if(desktop){assert.ok(Math.abs(cards[0].y-cards[2].y)<2);assert.ok(cards[0].w>=160&&cards[0].w<=220);}
  else assert.ok(cards[2].y>cards[0].y);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
  await f.shot({path:`audit/web-review/partner-design-${process.env.TEST_BROWSER||'chromium'}${process.env.TEST_AUTH==='1'?'-account':''}-${width}.png`});
  calls=[];
 }
 assert.deepEqual(errors,[]);
 console.log('Passed compact partner layout, one primary heading, search criteria, account tabs, compact desktop cards and 320/390/1024/1440 sizing. Mock API only.');
}catch(e){console.error({url:page.url(),calls,network,errors,input:await page.getByRole('textbox',{name:'Ortaklık ilanlarında ara',exact:true}).inputValue().catch(()=>null)});console.error((await page.locator('body').innerText()).slice(-1500));throw e;}
finally{await browser.close();}
