import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const origin=process.env.MOBILE_RELEASE_URL;
if(origin!=='https://ortaksat-rlem1u6vb-fatih5.vercel.app')throw Error('Use the reviewed design preview only');
const outputPrefix='design';
const name=process.env.TRUST_TEST_BROWSER||'chromium';
const browser=await (name==='webkit'?webkit:chromium).launch();
const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],checks=[],blocked=[];
page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
const shared=process.env.MOBILE_RELEASE_SHARE_FILE?JSON.parse(await readFile(process.env.MOBILE_RELEASE_SHARE_FILE,'utf8')):undefined;
if(shared)assert.equal(new URL(shared.url).origin,origin);
else if(process.env.VERCEL_OIDC_TOKEN)await context.route(origin+'/**',r=>r.continue({headers:{...r.request().headers(),'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN}}));
// Read-only public browsing. No account/listing/referral/payment mutation can
// reach the real backend during a release check.
const readRpcs=new Set(['mobile_catalogue_page','trust_v1_capabilities','search_listings','partner_directory']);
// The injected Vercel review toolbar is outside the product and keeps its own
// cross-origin connections alive. Exclude it from product layout verification.
await context.route('https://vercel.live/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await context.route('**/*.supabase.co/**',r=>{
 const req=r.request(),url=new URL(req.url());
 if(['GET','HEAD','OPTIONS'].includes(req.method())||(url.pathname.startsWith('/rest/v1/rpc/')&&readRpcs.has(url.pathname.split('/').at(-1))))return r.continue();
 blocked.push(url.pathname);return r.abort('blockedbyclient');
});
try{
 await mkdir('audit/mobile-web-design',{recursive:true});
 if(shared){
  await page.goto(shared.url,{waitUntil:'domcontentloaded'});
  // The share URL renders the home page too. Do not interrupt its bootstrap
  // requests with the first test navigation: WebKit reports canceled requests
  // as access-control exceptions even when the destination works correctly.
  await page.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));
  await page.waitForLoadState('networkidle');
 }
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const path of ['/','/explore','/kategori/emlak','/partner','/hakkimizda','/menu','/auth','/auth?mode=register','/auth?mode=reset']){
   const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,path);
   await page.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));
   // A full navigation while the store is still fetching cancels its requests;
   // WebKit reports those cancellations as access-control errors. Finish the
   // public bootstrap before navigating away, as in the isolated UI fixture.
   await page.waitForLoadState('networkidle');
   if(path==='/explore'&&width<1024){await page.getByTestId('explore-feed-filters').waitFor();assert.ok((await page.getByTestId('explore-feed-filters').boundingBox()).height<=52);}
   if(path==='/kategori/emlak'){await page.getByTestId('category-roots').waitFor();assert.ok((await page.getByTestId('category-roots').boundingBox()).height<=48);}
   if(path.startsWith('/auth')) {
    await page.getByRole('textbox',{name:'E-posta',exact:true}).waitFor();
    if(path.includes('mode=register')) await page.getByPlaceholder('Şifreni tekrar gir',{exact:true}).waitFor();
    else if(path.includes('mode=reset')) await page.getByRole('button',{name:'Sıfırlama kodu gönder',exact:true}).waitFor();
    else await page.getByRole('button',{name:'Şifremi unuttum',exact:true}).waitFor();
   }
   if(path==='/menu'&&width<1024) await page.getByTestId('web-account-menu').waitFor();
   // Let responsive mount effects update before reading geometry.
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} ${path}: overflow`);
   checks.push({width,path,status:200,overflow:false}); console.log(`${name} verified ${width} ${path}`);
   if(width===390){await page.screenshot({path:`audit/mobile-web-design/${outputPrefix}-${name}-${path.slice(1).replaceAll('/','-').replaceAll('?','-').replaceAll('=','-')||'home'}.png`});}
  }
 }
 await page.goto(origin+'/guven-merkezi',{waitUntil:'domcontentloaded'});await page.getByText('Güven Sistemi hazırlanıyor',{exact:true}).waitFor();
 await page.waitForLoadState('networkidle');
 assert.deepEqual(errors,[]);
 await writeFile(`audit/mobile-web-design/${outputPrefix}-${name}-checks.json`,JSON.stringify({origin,dataSource:'public-read-only-backend',checks,errors,trustEnabled:false,blockedWrites:blocked.length},null,2));
 console.log(`PASS ${name}: ${origin}, 45 route/viewport checks including login/register/reset/menu, compact filters/categories, no overflow or page exceptions; Trust remains off. Backend writes blocked. Data: public read-only.`);
}catch(error){console.error("Last page:",page.url(),"completed:",checks.length,"page exceptions:",JSON.stringify(errors));throw error;}finally{await browser.close();}
