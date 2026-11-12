import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
function module(file){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;}
const tree=module('lib/category-tree.ts'),locations=module('data/tr-locations.ts');let path;
function walk(nodes,p=[]){for(const n of nodes){if(n.key==='aricilik-ekipmani')path=[...p,n];if(n.children)walk(n.children,[...p,n]);}}walk(tree.topCategories());assert.ok(path);
const f=await mobileAuthFixture();const {page,browser,go,writes,errors}=f;
const district=locations.districts.find(d=>d.provinceId===34&&d.slug==='kadikoy');
const draft={savedAt:Date.now(),path:path.map(({key,label,slug,formKey})=>({key,label,slug,formKey})),values:{title:'Temiz arıcılık ekipmanı seti',description:'Ürün bakımlı ve temiz durumdadır. Ayrıntılı bilgi için mesaj atabilirsiniz.',price:'1500',condition:'Sıfır'},images:[new URL('/demo/001-bmw-3-20i-premium-line.jpg',process.env.MOBILE_TEST_URL).href],loc:{provinceId:34,districtId:district.id},visibility:'district',currency:'TRY',commissionType:'fixed',commissionValue:'100',partnershipMode:'none'};
await page.addInitScript(draft=>{
 localStorage.setItem('ortaksat_listing_draft_v1:anon',JSON.stringify(draft));window.__draftFail=true;window.__draftSaveCalls=0;
 const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='ortaksat_listing_draft_v1:anon-pending'){window.__draftSaveCalls++;if(window.__draftFail)throw new DOMException('Local test quota failure','QuotaExceededError');}return original.call(this,key,value);};
},draft);
try{
 await page.setViewportSize({width:1440,height:1000});await go('/create');
 await page.getByText('Devam et',{exact:true}).click();await page.getByTestId('field-title').waitFor();
 await page.getByRole('checkbox').last().click();
 await page.getByRole('button',{name:'İlanı Yayınla',exact:true}).evaluate(el=>{el.click();el.click();});
 await page.getByText('Taslak cihazına kaydedilemedi. Bilgilerin formda duruyor; girişe geçmeden önce tekrar dene.',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/create');assert.equal(await page.getByTestId('field-title').inputValue(),draft.values.title);
 assert.equal(await page.evaluate(()=>window.__draftSaveCalls),1);
 await page.evaluate(()=>{window.__draftFail=false;});
 await page.getByRole('button',{name:'İlanı Yayınla',exact:true}).click();await page.waitForURL(url=>url.pathname==='/auth'&&url.searchParams.get('redirect')==='/create');
 const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem('ortaksat_listing_draft_v1:anon-pending')));
 assert.equal(pending.values.title,draft.values.title);assert.equal(pending.images.length,1);assert.equal(pending.loc.districtId,district.id);
 assert.equal(writes.filter(w=>w.table==='listings').length,0);assert.deepEqual(errors,[]);
 console.log('Passed create storage recovery: valid draft restored, failed anon handoff retains form and stays on page, rapid publish writes once, retry stores draft before signup redirect, photos/location retained, no listing publication. Mock only.');
}catch(e){console.error(page.url(),(await page.locator('body').innerText()).slice(-2500));throw e;}finally{await browser.close();}
