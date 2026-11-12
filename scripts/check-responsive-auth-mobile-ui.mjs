import assert from 'node:assert/strict';import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const f=await mobileAuthFixture({verification:true});const {page,browser,go,errors}=f;
const metro=new URL(process.env.NAVIGATION_METRO_URL);assert.ok(['localhost','127.0.0.1'].includes(metro.hostname));const r=await fetch(`${metro.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);assert.ok(r.ok);const bundle=await r.text();
await page.route('**/_expo/static/js/web/entry-*.js',r=>r.fulfill({contentType:'application/javascript',body:bundle}));await page.route('**/assets/**',async r=>{const u=new URL(r.request().url());await r.fulfill({response:await r.fetch({url:metro.origin+u.pathname+u.search})});});
try{
 await go('/kategoriler');await page.getByRole('button',{name:'Geç',exact:true}).waitFor();
 await page.getByRole('tab',{name:'Hesap Oluştur',exact:true}).click();await page.getByRole('button',{name:'E-posta ile devam et',exact:true}).click();
 await page.getByPlaceholder('Ayşe',{exact:true}).fill('Örnek');await page.getByPlaceholder('Demir',{exact:true}).fill('Kullanıcı');await page.getByPlaceholder('ornek@eposta.com',{exact:true}).fill('preview@example.invalid');await page.getByPlaceholder('Güçlü bir şifre oluştur',{exact:true}).fill('LocalTest!2026');await page.getByPlaceholder('Şifreni tekrar gir',{exact:true}).fill('LocalTest!2026');
 for(const [width,height] of [[320,720],[390,844],[768,1024],[1024,768]]){await page.setViewportSize({width,height});await page.getByRole('button',{name:'Kayıt ol',exact:true}).scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);assert.equal(await page.getByPlaceholder('Ayşe',{exact:true}).inputValue(),'Örnek');}
 await page.getByRole('checkbox',{name:'Yasal metinleri kabul ediyorum',exact:true}).click();await page.getByRole('button',{name:'Kayıt ol',exact:true}).click();await page.getByText('E-postanı doğrula',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('Passed mobile development UI: initial landing, registration form at 320/390/768/1024, retained input, legal consent and verification transition. Mock only.');
}finally{await page.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
