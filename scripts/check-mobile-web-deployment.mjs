import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const origin=process.env.MOBILE_RELEASE_URL;
if(!['https://ortaksat-1ugxtctuo-fatih5.vercel.app','https://ortaksat-5xhk9ymou-fatih5.vercel.app','https://www.ortaksat.com'].includes(origin))throw Error('Use a reviewed deployment or approved production domain only');
const outputPrefix=origin==='https://www.ortaksat.com'?'live':origin==='https://ortaksat-5xhk9ymou-fatih5.vercel.app'?'preview-next':'deployed';
const name=process.env.TRUST_TEST_BROWSER||'chromium';
const browser=await (name==='webkit'?webkit:chromium).launch();
const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],checks=[],blocked=[];
page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
const shared=process.env.MOBILE_RELEASE_SHARE_FILE?JSON.parse(await readFile(process.env.MOBILE_RELEASE_SHARE_FILE,'utf8')):undefined;
if(shared)assert.equal(new URL(shared.url).origin,origin);
else if(process.env.VERCEL_OIDC_TOKEN)await context.route(origin+'/**',r=>r.continue({headers:{...r.request().headers(),'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN}}));
// Read-only public browsing. No account/listing/referral/payment mutation can
// reach the real backend during a release check.
const readRpcs=new Set(['mobile_catalogue_page','trust_v1_capabilities','search_listings']);
await context.route('**/*.supabase.co/**',r=>{
 const req=r.request(),url=new URL(req.url());
 if(['GET','HEAD','OPTIONS'].includes(req.method())||(url.pathname.startsWith('/rest/v1/rpc/')&&readRpcs.has(url.pathname.split('/').at(-1))))return r.continue();
 blocked.push(url.pathname);return r.abort('blockedbyclient');
});
try{
 await mkdir('audit/mobile-web-nov5',{recursive:true});
 if(shared)await page.goto(shared.url,{waitUntil:'domcontentloaded'});
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const path of ['/','/explore','/kategori/emlak','/partner','/hakkimizda']){
   const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,path);
   await page.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));
   // A full navigation while the store is still fetching cancels its requests;
   // WebKit reports those cancellations as access-control errors. Finish the
   // public bootstrap before navigating away, as in the isolated UI fixture.
   await page.waitForLoadState('networkidle');
   if(path==='/explore'&&width<1024){await page.getByTestId('explore-feed-filters').waitFor();assert.ok((await page.getByTestId('explore-feed-filters').boundingBox()).height<=52);}
   if(path==='/kategori/emlak'){await page.getByTestId('category-roots').waitFor();assert.ok((await page.getByTestId('category-roots').boundingBox()).height<=48);}
   // Let responsive mount effects update before reading geometry.
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} ${path}: overflow`);
   checks.push({width,path,status:200,overflow:false});
   if(width===390)await page.screenshot({path:`audit/mobile-web-nov5/${outputPrefix}-${name}-${path.slice(1).replaceAll('/','-')||'home'}.png`});
  }
 }
 await page.goto(origin+'/guven-merkezi',{waitUntil:'domcontentloaded'});await page.getByText('Güven Sistemi hazırlanıyor',{exact:true}).waitFor();
 await page.waitForLoadState('networkidle');
 assert.deepEqual(errors,[]);
 await writeFile(`audit/mobile-web-nov5/${outputPrefix}-${name}-checks.json`,JSON.stringify({origin,checks,errors,trustEnabled:false,blockedWrites:blocked.length},null,2));
 console.log(`PASS ${name}: ${origin}, 25 route/viewport checks, compact filters/categories, no overflow or page exceptions; Trust remains off. Backend writes blocked.`);
}finally{await browser.close();}
