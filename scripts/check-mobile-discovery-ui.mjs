import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
await mkdir('audit/mobile-v4',{recursive:true});
const f=await mobileAuthFixture({authenticated:true});const{page,browser,go,api,listing,shot,errors}=f;
const requests=[];let fail=false;
try{
 await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`,async route=>{const p=route.request().postDataJSON().params;requests.push(p);if(fail){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Local failure'})});return;}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({listings:[{...listing,featured:p.sort==='featured'}],total:1})});});
 await go('/explore');await page.getByRole('button',{name:`Keşfet ilanı: ${listing.title}`,exact:true}).waitFor();
 await shot({path:'audit/mobile-v4/discovery-390.png'});
 await page.getByRole('tab',{name:'Trend',exact:true}).click();await page.waitForTimeout(300);assert.equal(requests.at(-1).sort,'popular');
 await page.getByRole('tab',{name:'Öne Çıkanlar',exact:true}).click();await page.waitForTimeout(300);assert.equal(requests.at(-1).sort,'featured');
 await page.getByRole('tab',{name:'Yakınımda',exact:true}).click();await page.getByRole('button',{name:'İstanbul',exact:true}).click();await page.waitForTimeout(300);assert.equal(requests.at(-1).filters.loc.provinceId,34);
 await page.getByRole('button',{name:'Menü',exact:true}).click();await page.getByRole('button',{name:'Yan menüyü kapat',exact:true}).waitFor();
 await page.getByRole('button',{name:'Ortaklık Yönetimi',exact:true}).click();await page.getByRole('button',{name:'Ortaklık Faaliyet Geçmişi',exact:true}).waitFor();
 await shot({path:'audit/mobile-v4/drawer-390.png'});
 await page.getByRole('button',{name:'Yan menüyü kapat',exact:true}).click();await page.getByRole('button',{name:'Yan menüyü kapat',exact:true}).waitFor({state:'hidden'});
 assert.equal(new URL(page.url()).pathname,'/explore');
 await page.getByRole('button',{name:'Menü',exact:true}).click();await page.getByRole('button',{name:'Yan menüyü dışına dokunarak kapat',exact:true}).click({position:{x:12,y:200}});await page.getByRole('button',{name:'Yan menüyü kapat',exact:true}).waitFor({state:'hidden'});
 await page.getByRole('textbox',{name:"Keşfet'te ara",exact:true}).fill('BMW');await page.getByRole('textbox',{name:"Keşfet'te ara",exact:true}).press('Enter');
 await page.getByRole('button',{name:'Aramayı Kaydet',exact:true}).click();
 await go('/mobile-tools?mode=saved-searches');await page.getByText('BMW',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Aramayı Aç',exact:true}).click();await page.getByRole('button',{name:'Aramayı Kaydet',exact:true}).waitFor();
 assert.ok(requests.at(-1).q==='BMW');
 await page.setViewportSize({width:320,height:740});await go('/explore');await page.getByRole('button',{name:`Keşfet ilanı: ${listing.title}`,exact:true}).waitFor();await page.getByRole('button',{name:'Menü',exact:true}).click();await shot({path:'audit/mobile-v4/drawer-320.png'});
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('Passed isolated UI: discovery sorts, real province filter, drawer expand/close/backdrop, search and saved-query restoration, 320px drawer.');
}catch(error){console.error(page.url(),(await page.locator('body').innerText()).slice(0,2200));throw error;}finally{await browser.close();}
