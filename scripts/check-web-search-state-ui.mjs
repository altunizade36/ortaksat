import assert from 'node:assert/strict';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const f=await mobileAuthFixture({authenticated:true});
const {page,browser,go,api,errors}=f;
let saved=[];
await page.route(`${api}/rest/v1/saved_searches**`,async route=>{
 const req=route.request();
 if(req.method()==='POST') {const body=req.postDataJSON();saved=[{...(Array.isArray(body)?body[0]:body),created_at:new Date().toISOString()}];}
 await route.fulfill({json:saved});
});
const expected={rate:'5',rating:'4',featured:'1',verified:'1',province:'istanbul',district:'kadikoy',tab:'new'};
const search=new URLSearchParams({q:'BMW',...expected});
try {
 await page.setViewportSize({width:1440,height:1000});
 await go('/explore?'+search);
 await page.waitForFunction(()=>document.querySelector('input[role="combobox"]')?.value==='BMW');
 await page.getByText('“BMW” aramasını kaydet',{exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ortaksat_saved_searches_v1')||'[]').some(x=>x.q==='BMW'));
 const entry=await page.evaluate(()=>JSON.parse(localStorage.getItem('ortaksat_saved_searches_v1')).find(x=>x.q==='BMW'));
 assert.deepEqual(entry.f,{province:'istanbul',district:'kadikoy',rate:5,rating:4,verified:true,featured:true,tab:'new'});
 // Ensure the mocked remote upsert completed before a full reload.
 for(let i=0;i<100&&!saved.length;i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(saved.length,1);
 // JSONB may return a different key order; the already-saved marker must remain correct.
 saved[0].filters=Object.fromEntries(Object.entries(saved[0].filters).reverse());
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Kayıtlı aramayı aç: BMW',exact:true}).filter({visible:true}).first().waitFor();
 assert.equal(await page.getByText('“BMW” aramasını kaydet',{exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Kayıtlı aramayı aç: BMW',exact:true}).filter({visible:true}).count(),1,'Reordered server JSON must merge with the local saved search');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ortaksat_saved_searches_v1')).filter(x=>x.q==='BMW').length),1);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Tümünü temizle',exact:true}).click();
 await page.waitForURL(url=>Object.keys(expected).every(k=>!url.searchParams.has(k)));
 assert.equal(new URL(page.url()).searchParams.get('q'),'BMW');
 await page.getByRole('button',{name:'Kayıtlı aramayı aç: BMW',exact:true}).filter({visible:true}).first().click();
 await page.waitForURL(url=>Object.entries(expected).every(([k,v])=>url.searchParams.get(k)===v));
 await page.waitForFunction(()=>document.querySelector('input[role="combobox"]')?.value==='BMW');
 await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
 await f.shot({path:'audit/web-review/search-state-390.png'});
 // Change three formerly missing URL filters with their own remove actions.
 await page.getByRole('button',{name:'%5+ — kaldır',exact:true}).click();
 await page.waitForURL(url=>!url.searchParams.has('rate'));
 await page.getByRole('button',{name:'★ 4+ — kaldır',exact:true}).click();
 await page.waitForURL(url=>!url.searchParams.has('rating'));
 await page.getByRole('button',{name:'Öne çıkan — kaldır',exact:true}).click();
 await page.waitForURL(url=>!url.searchParams.has('featured'));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('input[role="combobox"]')?.value==='BMW');
 assert.equal(await page.getByRole('button',{name:'%5+ — kaldır',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'★ 4+ — kaldır',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Öne çıkan — kaldır',exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('Passed web search state: nested-header query, complete saved filters/location, reordered persisted JSON, 390px clear/restore, individual rate/rating/featured removal survives reload. Mock API only.');
}catch(e){console.error(page.url(),(await page.locator('body').innerText()).slice(-3000));throw e;}finally{await browser.close();}
