import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, go, api, listing, me, errors } = await mobileAuthFixture({ authenticated: true });
const metro = new URL(process.env.NAVIGATION_METRO_URL);
if (!['localhost','127.0.0.1'].includes(metro.hostname)) throw Error('Local Metro only');
const response = await fetch(`${metro.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);
assert.ok(response.ok); const bundle = await response.text();
await page.route('**/_expo/static/js/web/entry-*.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }));
await page.route('**/assets/**', async route => { const u = new URL(route.request().url()); await route.fulfill({ response: await route.fetch({ url: metro.origin + u.pathname + u.search }) }); });
const rows = [
  { partnership_mode:'open' }, { partnership_mode:'approval' }, { partnership_mode:'invite' },
  { partnership_mode:'open', status:'sold' }, { partnership_mode:'open', stock_count:0 },
  { partnership_mode:'approval', stock_count:0, attributes:{_formKey:'arayan'} },
].map((fields,i)=>({...listing,id:`bbbbbbbb-bbbb-4bbb-8bbb-${String(i+1).padStart(12,'0')}`,title:`Favori kurtarma örneği ${i+1}`,...fields}));
let failed = false, batchCalls = 0;
try {
  await page.route(`${api}/rest/v1/favorites**`, route => route.fulfill({json:rows.map((r,i)=>({id:`fav-${i}`,listing_id:r.id,user_id:me,created_at:new Date(Date.now()-(i>1?20:1)*86400000).toISOString()}))}));
  await page.route(`${api}/rest/v1/listing_public_cards**`, route => {
    const req=route.request(),id=new URL(req.url()).searchParams.get('id');
    if(id?.startsWith('in.')) { batchCalls++; if(failed)return route.fulfill({status:503,json:{message:'Local favorites outage'}}); }
    const found=id?.startsWith('in.')?rows.filter(r=>id.includes(r.id)):rows.slice(0,1);
    return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?found[0]||null:found});
  });
  await go('/kategoriler'); await page.getByTestId('mobile-bottom-nav').getByRole('button',{name:'Menü',exact:true}).click();
  await page.getByRole('button',{name:'Favorilerim',exact:true}).click();
  await page.getByRole('button',{name:'Ortaklığa Açık (3)',exact:true}).waitFor();
  assert.ok(batchCalls>0);
  await page.getByRole('button',{name:'Ortaklığa Açık (3)',exact:true}).click();
  for(const i of [0,1,5])await page.getByRole('button',{name:`${rows[i].title} ilanını aç`,exact:true}).waitFor();
  for(const i of [2,3,4])assert.equal(await page.getByRole('button',{name:`${rows[i].title} ilanını aç`,exact:true}).count(),0);
  await page.getByRole('button',{name:'Favorilerde ara',exact:true}).click();
  await page.getByRole('textbox',{name:'Favorilerinde ara',exact:true}).fill('bulunmayan');
  await page.getByRole('button',{name:'Arama ve filtreleri temizle',exact:true}).click();
  await page.getByRole('button',{name:`${rows[4].title} ilanını aç`,exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Favorilerinde ara',exact:true}).fill('bulunmayan');
  await page.getByRole('button',{name:'Aramayı kapat',exact:true}).click();
  await page.getByRole('button',{name:`${rows[4].title} ilanını aç`,exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Favorilerinde ara',exact:true}).count(),0);
  failed=true;await page.getByRole('button',{name:'Favori seçenekleri',exact:true}).click();await page.getByRole('button',{name:'Yenile',exact:true}).click();
  await page.getByText('Bazı ilanlar yüklenemedi. Kaydedilen favorilerin korunuyor.',{exact:true}).waitFor();
  await page.getByRole('button',{name:`${rows[4].title} ilanını aç`,exact:true}).waitFor();
  failed=false;await page.getByRole('button',{name:'Tekrar yükle',exact:true}).click();
  await page.getByText('Bazı ilanlar yüklenemedi. Kaydedilen favorilerin korunuyor.',{exact:true}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Ortaklığa Açık (3)',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  await writeFile('audit/mobile-v4/favorites-recovery-ui.json',JSON.stringify({mockOnly:true,publicApplicationsCount:3,searchCloseClearsHiddenQuery:true,emptyViewCanReset:true,refreshOutageKeepsRows:true,batchCalls,errors},null,2));
  console.log('Passed mobile favorite eligibility, empty-view reset, search close, refresh failure retention and retry.');
}catch(error){console.error(page.url(),(await page.locator('body').innerText()).slice(-1800));throw error;}
finally{await browser.close();}
