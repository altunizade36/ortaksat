import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const {browser,page,go,me,writes,errors}=await mobileAuthFixture({authenticated:true});
const metro=new URL(process.env.NAVIGATION_METRO_URL);if(!['localhost','127.0.0.1'].includes(metro.hostname))throw Error('Local Metro only');
const response=await fetch(`${metro.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);assert.ok(response.ok);const bundle=await response.text();
await page.route('**/_expo/static/js/web/entry-*.js',r=>r.fulfill({contentType:'application/javascript',body:bundle}));
await page.route('**/assets/**',async r=>{const u=new URL(r.request().url());await r.fulfill({response:await r.fetch({url:metro.origin+u.pathname+u.search})});});
await page.addInitScript(me=>{
 localStorage.setItem(`ortaksat_listing_draft_v1:${me}`,JSON.stringify({savedAt:Date.now(),path:[],values:{title:'Yerel test taslağı korunmalı'},images:Array.from({length:5},(_,i)=>`${location.origin}/demo/001-bmw-3-20i-premium-line.jpg?photo=${i}`),loc:{},currency:'TRY',commissionType:'fixed',commissionValue:'150',partnershipMode:'none'}));
},me);
try{
 await go('/kategoriler');await page.getByTestId('mobile-bottom-nav').getByRole('button',{name:'İlan Ver',exact:true}).click();
 const bar=page.getByTestId('create-step-actions');await bar.waitFor();
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  await page.getByRole('button',{name:'Ürün bilgilerine devam et',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'En az bir fotoğraf ekle.'}).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'1. Fotoğraf',exact:true}).getAttribute('aria-pressed'),'true');
  const b=await bar.boundingBox(),nav=await page.getByTestId('mobile-bottom-nav').last().boundingBox();
  assert.ok(b.y+b.height<=nav.y+1);assert.ok(b.y>=0&&b.y+b.height<=844);
 }
 await page.getByRole('button',{name:'Taslağa devam et',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Başlık',exact:true}).inputValue(),'Yerel test taslağı korunmalı');
 assert.equal(await page.getByRole('button',{name:'Fotoğraf ekle',exact:true}).count(),0);
 await page.getByRole('button',{name:'Ürün bilgilerine devam et',exact:true}).click();
 await page.getByRole('button',{name:'Ortaklık ayarlarına devam et',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'bir kategori seç'}).first().waitFor();
 await page.getByRole('button',{name:'Önceki',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'1. Fotoğraf',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Fotoğraf 3 büyüt',exact:true}).click();
 await page.getByRole('button',{name:'Kapak Yap',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Öne taşı',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Arkaya taşı',exact:true}).click();
 await page.getByRole('button',{name:'Öne taşı',exact:true}).click();
 await page.getByRole('button',{name:'Fotoğrafı Kaldır',exact:true}).click();
 await page.getByRole('button',{name:'Fotoğraf ekle',exact:true}).waitFor();
 await page.getByRole('button',{name:'Geri al',exact:true}).click();
 await page.waitForFunction(me=>{const draft=JSON.parse(localStorage.getItem(`ortaksat_listing_draft_v1:${me}`)||'{}');return draft.images?.length===5&&draft.images[0].endsWith('photo=2');},me);

 assert.equal(await page.getByRole('button',{name:'Fotoğraf ekle',exact:true}).count(),0);
 assert.equal(await page.getByRole('textbox',{name:'Başlık',exact:true}).inputValue(),'Yerel test taslağı korunmalı');
 await page.getByRole('button',{name:'3. Ortaklık Ayarları',exact:true}).click();
 await page.getByRole('button',{name:'Geri',exact:true}).last().click();
 assert.equal(await page.getByRole('button',{name:'2. Ürün Bilgileri',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Geri',exact:true}).last().click();
 assert.equal(await page.getByRole('button',{name:'1. Fotoğraf',exact:true}).getAttribute('aria-pressed'),'true');
 assert.match(page.url(),/\/create/);
 assert.equal(writes.filter(w=>w.table==='listings').length,0);assert.deepEqual(errors,[]);
 await writeFile('audit/mobile-v4/create-step-actions-ui.json',JSON.stringify({mockOnly:true,widths:[320,390],stickyActions:true,photoFirstValidation:true,categoryGuard:true,previousStep:true,photoLimit:5,draftAndCoverPreserved:true,photoReorderingAndUndo:true,noPublication:true,errors},null,2));
 console.log('Passed sticky create actions, photo/category guards, previous step, five-photo draft and cover change without publishing.');
}catch(error){console.error((await page.locator('body').innerText()).slice(-2000));throw error;}
finally{await browser.close();}
