import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TRUST_PREVIEW_URL;
if(!origin||!['ortaksat-opsmltfor-fatih5.vercel.app','ortaksat-db3u3vr1l-fatih5.vercel.app'].includes(new URL(origin).hostname))throw Error('Use a reviewed preview deployment only');
const browser=await chromium.launch(),context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
if(!process.env.VERCEL_OIDC_TOKEN)throw Error('Run through vercel env run to obtain scoped preview access');
await context.route(origin+'/**',route=>route.continue({headers:{...route.request().headers(),'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN}}));
const errors=[],blocked=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request();
 if(['GET','HEAD','OPTIONS'].includes(req.method())||new URL(req.url()).pathname==='/rest/v1/rpc/trust_v1_capabilities')return route.continue();
 blocked.push(new URL(req.url()).pathname);return route.abort('blockedbyclient');
});
try{
 await mkdir('audit/trust-v1',{recursive:true});const checks=[];
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});
  const response=await page.goto(origin+'/guven-merkezi',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
  await page.getByText('Güven Sistemi hazırlanıyor',{exact:true}).waitFor({timeout:45000});
  await page.evaluate(()=>{for(const e of document.querySelectorAll('*'))if(e.scrollHeight>e.clientHeight+10)e.scrollTop=0;});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.getByTestId('mobile-bottom-nav').count(),width>=1000?0:1);
  await page.screenshot({path:`audit/trust-v1/preview-${width}.png`,fullPage:true});checks.push({path:'/guven-merkezi',width,status:200,trustEnabled:false,overflow:false});
 }
 for(const path of ['/guven-profili','/guven-yonlendirme','/trust','/partner','/auth']){
  const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,path);checks.push({path,status:response.status()});
 }
 assert.deepEqual(errors,[]);await writeFile('audit/trust-v1/preview-checks.json',JSON.stringify({checks,errors,blockedWrites:blocked.length},null,2));
 console.log('PASS: reviewed preview, 320/390/1440 widths, correct desktop/mobile navigation, Trust remains off, six routes HTTP 200, no page exceptions. Supabase writes blocked.');
}finally{await browser.close();}
