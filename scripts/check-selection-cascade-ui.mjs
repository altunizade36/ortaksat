import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;}
const mobile=process.env.SELECTION_MOBILE==='1',tree=load('lib/category-tree.ts').topCategories(),locs=load('data/tr-locations.ts');
const f=await mobileAuthFixture({authenticated:true});const {page,browser,go,me,api,writes,errors}=f;
if(mobile){const metro=new URL(process.env.NAVIGATION_METRO_URL);assert.ok(['localhost','127.0.0.1'].includes(metro.hostname));const response=await fetch(`${metro.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);assert.ok(response.ok);const bundle=await response.text();await page.route('**/_expo/static/js/web/entry-*.js',r=>r.fulfill({contentType:'application/javascript',body:bundle}));await page.route('**/assets/**',async r=>{const u=new URL(r.request().url());await r.fulfill({response:await r.fetch({url:metro.origin+u.pathname+u.search})});});}
let path;function walk(nodes,p=[]){for(const n of nodes){const next=[...p,n];if(n.label==='Diğer Model'&&next.some(n=>n.label==='BMW')&&next.some(n=>n.label==='Otomobil'))path=next;if(n.children)walk(n.children,next);}}walk(tree);assert.ok(path);
const kadikoy=locs.districts.find(d=>d.provinceId===34&&d.slug==='kadikoy'),cankaya=locs.districts.find(d=>d.provinceId===6&&d.slug==='cankaya');
const queries=[];let fail=true,hold=false,release;
await page.route(`${api}/rest/v1/neighborhoods?**`,async route=>{
 const id=Number(new URL(route.request().url()).searchParams.get('district_id').slice(3));queries.push(id);
 if(fail){await route.fulfill({status:503,json:{message:'Local lookup failure'}});return;}
 const delayed=hold&&id===kadikoy.id;if(delayed)await new Promise(resolve=>{release=resolve;});
 await route.fulfill({json:[{id:id*10,province_id:id===kadikoy.id?34:6,district_id:id,name:delayed?'Gecikmiş Eski Mahalle':id===kadikoy.id?'Yeni Mahalle':'Ankara Örnek Mahallesi',slug:'ornek'}]});
});
await page.addInitScript(({me,path,cankaya})=>localStorage.setItem(`ortaksat_listing_draft_v1:${me}`,JSON.stringify({savedAt:Date.now(),path:path.map(({key,label,slug,formKey})=>({key,label,slug,formKey})),values:{title:'Kategori ve konum korunmalı'},images:[`${location.origin}/demo/001-bmw-3-20i-premium-line.jpg`],loc:{provinceId:34,districtId:cankaya.id,neighborhood:'Eski mahalle',neighborhoodId:999},visibility:'district_only',currency:'TRY',commissionType:'fixed',commissionValue:'100',partnershipMode:'none'})),{me,path,cankaya});
async function choose(field,value,query=value){await page.getByRole('button',{name:new RegExp(`^${field} [*]:`)}).click();await page.getByPlaceholder('Ara…',{exact:true}).fill(query);await page.getByRole('button',{name:value,exact:true}).click();await page.getByPlaceholder('Ara…',{exact:true}).waitFor({state:'hidden'});}
async function until(fn){for(let i=0;i<150&&!fn();i++)await new Promise(r=>setTimeout(r,20));assert.ok(fn());}
try{
 await page.setViewportSize({width:mobile?390:1440,height:900});
 if(mobile){await go('/kategoriler');await page.getByTestId('mobile-bottom-nav').getByRole('button',{name:'İlan Ver',exact:true}).click();await page.getByRole('button',{name:'Taslağa devam et',exact:true}).click();await page.getByRole('button',{name:'İlan kategorisi seç',exact:true}).click();await page.getByRole('button',{name:'Vasıta / Otomobil / BMW / Diğer Model',exact:true}).waitFor();await page.getByRole('button',{name:'Kapat',exact:true}).last().click();}
 else {await go('/create');await page.getByText('Devam et',{exact:true}).click();const levels=page.getByTestId('listing-category-levels');assert.equal(await levels.getByText('Alt kategori',{exact:true}).count(),3);await levels.getByText('BMW',{exact:true}).waitFor();await levels.getByText('Diğer Model',{exact:true}).waitFor();}
 await page.getByRole('alert').filter({hasText:'Kayıtlı konumdaki il veya ilçe'}).waitFor();
 const neighborhood=()=>page.getByRole('textbox',{name:'Mahalle / Köy',exact:true});assert.equal(await neighborhood().isEditable(),false);assert.equal(await neighborhood().inputValue(),'');assert.equal(queries.length,0,'Invalid district must not request neighborhoods');
 await choose('İl','İstanbul','istanbul');await choose('İlçe','Kadıköy','kadikoy');
 await page.getByText('Mahalle listesi yüklenemedi. Tekrar deneyebilir veya mahalle adını yazabilirsin.',{exact:true}).waitFor();await neighborhood().fill('Elle yazılan mahalle');
 fail=false;await page.getByRole('button',{name:'Mahalleleri yeniden yükle',exact:true}).click();
 await page.getByRole('button',{name:/^Mahalle \/ Köy:/}).click();await page.getByRole('button',{name:'Yeni Mahalle',exact:true}).click();
 await page.getByRole('radio',{name:'Mahalleye kadar',exact:true}).click();await page.getByTestId('listing-location-preview').getByText('İstanbul / Kadıköy / Yeni Mahalle',{exact:true}).waitFor();
 await choose('İl','İstanbul','istanbul');await page.getByTestId('listing-location-preview').getByText('İstanbul / Kadıköy / Yeni Mahalle',{exact:true}).waitFor();
 await choose('İl','Ankara','ankara');assert.equal(await neighborhood().isEditable(),false);assert.equal(await neighborhood().inputValue(),'');await choose('İlçe','Çankaya','cankaya');await page.getByRole('button',{name:/^Mahalle \/ Köy:/}).waitFor();
 // Release an obsolete neighborhood response after selecting a different province/district.
 hold=true;await choose('İl','İstanbul','istanbul');await choose('İlçe','Kadıköy','kadikoy');await until(()=>release);await choose('İl','Ankara','ankara');await choose('İlçe','Çankaya','cankaya');await page.getByRole('button',{name:/^Mahalle \/ Köy:/}).waitFor();release();
 await page.getByRole('button',{name:/^Mahalle \/ Köy:/}).click();await page.getByRole('button',{name:'Ankara Örnek Mahallesi',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Gecikmiş Eski Mahalle',exact:true}).count(),0);await page.getByRole('button',{name:'Ankara Örnek Mahallesi',exact:true}).click();
 const title=mobile?page.getByRole('textbox',{name:'Başlık',exact:true}):page.getByTestId('field-title');assert.equal(await title.inputValue(),'Kategori ve konum korunmalı');
 if(!mobile){const levels=page.getByTestId('listing-category-levels');await levels.getByText('Vasıta',{exact:true}).click();await page.getByText('Emlak',{exact:true}).last().click();assert.equal(await levels.getByText('BMW',{exact:true}).count(),0);await levels.getByText('Alt kategori seç',{exact:true}).waitFor();for(const label of ['Konut','Satılık','Daire','3+1']){await levels.getByText('Alt kategori seç',{exact:true}).last().click();await page.getByText(label,{exact:true}).last().click();}assert.equal(await title.inputValue(),'Kategori ve konum korunmalı');}
 await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);await f.shot({path:`audit/web-review/selection-cascade-${mobile?'mobile':'web'}.png`});assert.equal(writes.filter(w=>w.table==='listings').length,0);assert.deepEqual(errors,[]);
 console.log(`Passed ${mobile?'mobile preview':'web'} category/location: complete restored hierarchy, invalid district blocked, manual fallback/retry, same province preservation, province change clears descendants, delayed response isolated, title preserved and no publication.`);
}catch(e){console.error(page.url(),(await page.locator('body').innerText()).slice(-3300));throw e;}finally{await browser.close();}
