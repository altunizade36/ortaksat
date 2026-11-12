import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const {browser,page,go,api,listing,me,writes,errors}=await mobileAuthFixture({authenticated:true});
const metro=new URL(process.env.NAVIGATION_METRO_URL);if(!['localhost','127.0.0.1'].includes(metro.hostname))throw Error('Local Metro only');
const response=await fetch(`${metro.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);assert.ok(response.ok);const bundle=await response.text();
await page.route('**/_expo/static/js/web/entry-*.js',r=>r.fulfill({contentType:'application/javascript',body:bundle}));
await page.route('**/assets/**',async r=>{const u=new URL(r.request().url());await r.fulfill({response:await r.fetch({url:metro.origin+u.pathname+u.search})});});
const row={...listing,owner_id:me,title:'Fotoğraf sıralama düzenleme test ilanı',ad_assets:[new URL('/demo/010-hyundai-i20-elite.jpg',listing.image_url).href,new URL('/demo/020-google-pixel-8-pro.jpg',listing.image_url).href]};
try{
 await page.route(`${api}/rest/v1/listing_public_cards**`,r=>r.fulfill({json:r.request().headers().accept?.includes('vnd.pgrst.object')?row:[row]}));
 await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`,r=>r.fulfill({json:{listings:[row],total:1}}));
 await go('/kategoriler');await page.getByRole('button',{name:'Emlak',exact:true}).click();
 await page.getByRole('button',{name:row.title,exact:true}).click();await page.getByRole('button',{name:'İlanı Düzenle',exact:true}).click();
 const cover=page.getByTestId('edit-photo-0').locator('img').first();await cover.waitFor();
 const old=await cover.getAttribute('src');
 assert.equal(await page.getByRole('button',{name:'Düzenleme fotoğraf 1 öne taşı',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'Düzenleme fotoğraf 3 arkaya taşı',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Düzenleme fotoğraf 2 öne taşı',exact:true}).click();
 await page.waitForFunction(old=>document.querySelector('[data-testid="edit-photo-0"] img')?.getAttribute('src')!==old,old);
 const changed=await cover.getAttribute('src');assert.notEqual(changed,old);
 await page.getByRole('button',{name:'Düzenleme fotoğraf 1 kaldır',exact:true}).click();
 await page.getByTestId('edit-photo-2').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Geri al',exact:true}).click();await page.getByTestId('edit-photo-2').waitFor();
 await page.waitForFunction(uri=>document.querySelector('[data-testid="edit-photo-0"] img')?.getAttribute('src')===uri,changed);
 assert.equal(writes.filter(w=>w.table==='listings').length,0);assert.deepEqual(errors,[]);
 await writeFile('audit/mobile-v4/editor-photo-order-ui.json',JSON.stringify({mockOnly:true,reorderChangesCover:true,undoRestoresSameCover:true,boundariesDisabled:true,noServerSave:true,errors},null,2));
 console.log('Passed editor photo reorder, cover identity, remove/undo and boundary actions without saving.');
}catch(error){console.error(await page.getByTestId('edit-photo-0').evaluate(el=>el.outerHTML),page.url(),(await page.locator('body').innerText()).slice(-1600));throw error;}
finally{await browser.close();}
