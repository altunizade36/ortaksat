import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
import assert from 'node:assert/strict';
const f=await mobileAuthFixture({authenticated:true});const {page,browser,api,listing,me,errors,go,shot}=f;
let initialFail=true,moreFail=true,favoritesFail=true,holdOldPage=false,releaseOldPage,batchMode=false;const calls=[],favoriteBatches=[];
const extraId='99999999-9999-4999-8999-999999999999';
const remote={...listing,id:extraId,title:'Favoriden Geri Gelen iPhone',owner_id:me};
try{
 await page.setViewportSize({width:1440,height:1000});
 await page.route(`${api}/rest/v1/rpc/search_listings`,async route=>{
  const p=route.request().postDataJSON();calls.push(p);
  if(initialFail||p.off&&moreFail){await route.fulfill({status:503,json:{message:'Local search failure'}});return;}
  if(p.off&&holdOldPage)await new Promise(resolve=>{releaseOldPage=resolve;});
  const count=p.off?1:40;
  await route.fulfill({json:Array.from({length:count},(_,i)=>({...listing,id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(p.off+i).padStart(12,'0')}`,title:`${p.q==='Audi'?'Audi':'BMW'} Web Sonuç ${String(p.off+i+1).padStart(3,'0')}`}))});
 });
 await go('/');
 await go('/explore?q=BMW');
 await page.getByRole('alert').filter({hasText:'Arama tamamlanamadı'}).waitFor();
 initialFail=false;await page.getByRole('button',{name:'Tekrar Dene',exact:true}).click();
 await page.getByText('BMW Web Sonuç 001',{exact:true}).first().waitFor();
 await page.getByText('Daha fazla göster',{exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Diğer arama sonuçları yüklenemedi'}).waitFor();
 await page.getByText('BMW Web Sonuç 001',{exact:true}).first().waitFor();
 assert.equal(calls.at(-1).off,40);
 moreFail=false;await page.getByRole('button',{name:'Tekrar Dene',exact:true}).click();
 await page.getByText('Daha fazla göster',{exact:true}).click();
 await page.getByText('BMW Web Sonuç 041',{exact:true}).waitFor();
 assert.equal(calls.at(-1).off,40,'Failed page must retry the same offset');
 // A delayed old page must not overwrite a new query in the same component.
 await go('/explore?q=BMW');await page.getByText('BMW Web Sonuç 001',{exact:true}).first().waitFor();
 holdOldPage=true;await page.getByText('Daha fazla göster',{exact:true}).click();
 await page.waitForFunction(()=>true);
 for(let i=0;i<250&&!releaseOldPage;i++)await new Promise(r=>setTimeout(r,20));
 assert.ok(releaseOldPage,"A second-page request must start");
 const search=page.getByPlaceholder(/ara/i).first();await search.fill('Audi');await search.press('Enter');
 await page.getByText('Audi Web Sonuç 001',{exact:true}).first().waitFor();
 const oldResponse=page.waitForResponse(r=>r.url().endsWith('/rpc/search_listings')&&r.request().postDataJSON()?.off===40);
 releaseOldPage();await oldResponse;
 await page.getByText('Audi Web Sonuç 001',{exact:true}).first().waitFor();
 assert.equal(await page.getByText('BMW Web Sonuç 041',{exact:true}).count(),0,'Old query page must not leak into current results');
 const batchIds=Array.from({length:301},(_,i)=>`bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12,'0')}`);
 await page.route(`${api}/rest/v1/favorites**`,async route=>route.fulfill({json:(batchMode?batchIds:[extraId]).map((id,i)=>({id:`cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12,'0')}`,listing_id:id,user_id:me,created_at:new Date().toISOString()}))}));
 await page.route(`${api}/rest/v1/listing_public_cards**`,async route=>{
  const id=new URL(route.request().url()).searchParams.get('id');
  if(!id?.startsWith('in.')){await route.fallback();return;}
  const requested=id.slice(4,-1).split(",");
  if(!requested.some(x=>batchMode?x.startsWith("bbbbbbbb-"):x===extraId)){await route.fallback();return;}
  favoriteBatches.push(id);
  if(favoritesFail){await route.fulfill({status:503,json:{message:'Local favorite failure'}});return;}
  await route.fulfill({json:[batchMode?{...remote,id:id.slice(4,-1).split(',')[0],title:'Parçalı Yüklenen Favori'}:remote]});
 });
 await go('/favorites');
 await page.getByRole('alert').filter({hasText:'Bazı favori ilanların yüklenemedi'}).waitFor();
 assert.equal(await page.getByText('Favori yok',{exact:true}).count(),0,'Loading failure is not an empty favorites list');
 await shot({path:'audit/web-review/favorites-retry-1440.png'});
 const failedCalls=favoriteBatches.length;favoritesFail=false;await page.getByRole('button',{name:'Tekrar Dene',exact:true}).click();
 await page.getByText(remote.title,{exact:true}).waitFor();
 assert.ok(favoriteBatches.length>failedCalls,'Failed favorite IDs must remain retryable');
 await page.setViewportSize({width:320,height:844});
 await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth, undefined, {timeout:10000});
 batchMode=true;const batchStart=favoriteBatches.length;await go('/favorites');
 await page.getByText('Parçalı Yüklenen Favori',{exact:true}).first().waitFor();
 await page.getByRole('progressbar').waitFor({state:'hidden'});
 const batches=favoriteBatches.slice(batchStart).map(s=>s.slice(4,-1).split(','));
 assert.ok(batches.some(b=>b.length===300)&&batches.some(b=>b.length===1)&&batches.every(b=>b.length<=300),'Favorites beyond the 300-ID request cap must also be fetched');
 assert.equal(new Set(batches.flat()).size,301);
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('Passed web recovery: initial search failure/retry, failed pagination retains rows and offset, missing favorite failure/retry, correct empty state, delayed-query isolation, 301 favorites in 300+1 batches and 320px. All data mocked.');
}catch(e){console.error('PAGE ERRORS',JSON.stringify(errors),'RPC calls',JSON.stringify(calls));console.error(page.url(),(await page.locator('body').innerText()).slice(-3800));throw e;}finally{await browser.close();}
