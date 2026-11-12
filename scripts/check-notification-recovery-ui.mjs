import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const {browser,page,go,api,me,errors}=await mobileAuthFixture({authenticated:true});
const native=process.env.NOTIFICATION_MOBILE==='1';
if(native){
  const metro=new URL(process.env.NAVIGATION_METRO_URL);if(!['localhost','127.0.0.1'].includes(metro.hostname))throw Error('Local Metro only');
  const response=await fetch(`${metro.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);assert.ok(response.ok);const bundle=await response.text();
  await page.route('**/_expo/static/js/web/entry-*.js',r=>r.fulfill({contentType:'application/javascript',body:bundle}));
  await page.route('**/assets/**',async r=>{const u=new URL(r.request().url());await r.fulfill({response:await r.fetch({url:metro.origin+u.pathname+u.search})});});
}else await page.setViewportSize({width:1440,height:1000});
let rows=[0,1].map(i=>({id:`bbbbbbbb-bbbb-4bbb-8bbb-${String(i+1).padStart(12,'0')}`,user_id:me,type:'system',title:`Yerel bildirim kontrolü ${i+1}`,body:'Gerçek işlem oluşturmayan test duyurusu.',read:false,created_at:new Date().toISOString()}));
let failRead=true,failRefresh=false;
const patches=[];
try{
 await page.route(`${api}/rest/v1/notifications**`,async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()==='PATCH'){
   const id=url.searchParams.get('id')?.replace('eq.','');assert.equal(url.searchParams.get('user_id'),`eq.${me}`);patches.push(id);
   if(failRead&&id===rows[0].id)return route.fulfill({status:503,json:{message:'Local read update outage'}});
   rows=rows.map(n=>n.id===id?{...n,read:true}:n);return route.fulfill({json:{id}});
  }
  if(failRefresh)return route.fulfill({status:503,json:{message:'Local inbox outage'}});
  return route.fulfill({json:rows});
 });
 if(native){await go('/kategoriler');await page.getByTestId('mobile-bottom-nav').getByRole('button',{name:'Menü',exact:true}).click();await page.getByRole('button',{name:'Bildirimlerim',exact:true}).first().click();}
 else await go('/notifications');
 await page.getByRole('button',{name:rows[0].title,exact:true}).click();
 await page.getByText('Bildirim Detayı',{exact:true}).waitFor();
 await page.getByText('Okundu bilgisi kaydedilemedi. Tekrar deneyebilirsin.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Bildirimlere Dön',exact:true}).click();
 if(native)await page.getByRole('button',{name:'Sadece okunmamış',exact:true}).click();
 await page.getByRole('button',{name:rows[0].title,exact:true}).waitFor();
 const all=()=>page.getByRole('button',{name:'Tümünü okundu işaretle',exact:true});
 const before=patches.length;
 await all().click();
 await page.getByText('Bazı bildirimler okundu işaretlenemedi. Tekrar deneyebilirsin.',{exact:true}).waitFor();
 assert.equal(patches.length-before,2);
 if(native){await page.getByRole('button',{name:rows[0].title,exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:rows[1].title,exact:true}).count(),0);}
 failRead=false;await all().click();
 if(native){await all().waitFor({state:'hidden'});await page.getByRole('button',{name:'Tüm Bildirimleri Göster',exact:true}).click();}
 else await page.waitForFunction(()=>document.querySelector('[aria-label="Tümünü okundu işaretle"]')?.getAttribute('aria-disabled')==='true');
 failRefresh=true;await page.getByRole('button',{name:'Bildirimleri Yenile',exact:true}).click();
 await page.getByText('Bildirimler yenilenemedi. Tekrar deneyebilirsin.',{exact:true}).waitFor();
 await page.getByRole('button',{name:rows[0].title,exact:true}).waitFor();
 failRefresh=false;rows.push({...rows[0],id:'bbbbbbbb-bbbb-4bbb-8bbb-000000000003',title:'Yenilemeyle gelen bildirim',read:false});
 await page.getByRole('button',{name:'Bildirimleri Yenile',exact:true}).click();await page.getByRole('button',{name:'Yenilemeyle gelen bildirim',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 await writeFile(`audit/${native?'mobile-v4':'web-review'}/notification-recovery-ui.json`,JSON.stringify({mockOnly:true,singleFailureRollsBack:true,partialBulkFailureRetry:true,refreshFailureKeepsInbox:true,retryLoadsNewNotification:true,scopedWrites:patches.length,errors},null,2));
 console.log(`Passed ${native?'mobile':'web'} read rollback, partial bulk retry and independent inbox failure/retry.`);
}catch(error){console.error(page.url(),(await page.locator('body').innerText()).slice(-1800));throw error;}
finally{await browser.close();}
