import assert from 'node:assert/strict';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';

const {browser,page,go,errors,api,listing}=await mobileAuthFixture({browserName:process.env.TEST_BROWSER||'chromium'});
// Explicit CORS for WebKit's cross-origin mock responses, including preflight.
await page.route(`${api}/**`,async route=>{
 const request=route.request(),table=new URL(request.url()).pathname.split('/').at(-1);
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
 if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(request.method()==='GET'&&['listing_public_cards','profiles'].includes(table))return route.fulfill({json:table==='profiles'?[]:[listing],headers});
 return route.fallback();
});
const message='Geçerli bir aralık gir. Örnek: 1.500 veya 1.500,50. Eksi işareti ve harf kullanma.';
try {
 await page.setViewportSize({width:1440,height:1000});
 await go('/explore');
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:1000});
  let min=page.getByRole('textbox',{name:'Minimum fiyat',exact:true}).filter({visible:true});
  if(!await min.count()) await page.getByText(width<1000?'Filtre':'Fiyat',{exact:true}).filter({visible:true}).first().click();
  min=page.getByRole('textbox',{name:'Minimum fiyat',exact:true}).filter({visible:true});
  const max=page.getByRole('textbox',{name:'Maksimum fiyat',exact:true}).filter({visible:true});
  await min.waitFor();
  const apply=min.locator('..').getByText('Uygula',{exact:true});
  // The dropdown places its action in the next row.
  const button=await apply.count()?apply:min.locator('../..').getByText('Uygula',{exact:true});
  for(const bad of ['-500','1e3','12.34','1,2,3']) {
   const before=new URL(page.url()).searchParams.get('price');
   await min.fill(bad);await max.fill('2000');await button.click();
   await page.getByText(message,{exact:true}).filter({visible:true}).waitFor();
   assert.equal(await min.inputValue(),bad);
   assert.equal(new URL(page.url()).searchParams.get('price'),before);
  }
  await min.fill('2000');await max.fill('1500');await button.click();
  await page.getByText('Minimum fiyat, maksimum fiyattan büyük olamaz.',{exact:true}).filter({visible:true}).waitFor();
  assert.equal(await min.inputValue(),'2000');assert.equal(await max.inputValue(),'1500');
  await min.fill('1.500,50');await max.fill('2.000,75');await button.click();
  await page.waitForURL(u=>u.searchParams.get('price')==='1500.5-2000.75');
  // A full reload also proves canonical URL decimals reopen as Turkish input.
  await page.reload({waitUntil:'domcontentloaded'});
  min=page.getByRole('textbox',{name:'Minimum fiyat',exact:true}).filter({visible:true});
  if(!await min.count()) await page.getByText(width<1000?'Filtre':'₺1.500,5–₺2.000,75',{exact:true}).filter({visible:true}).first().click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('input[aria-label="Minimum fiyat"]')).some(el=>el.value==='1500,5'));
  assert.equal(await min.inputValue(),'1500,5');
  await go('/explore');
 }
 assert.deepEqual(errors,[]);
 console.log('Passed responsive price-filter validation: malformed/reversed values retained, URL unchanged on error, decimal bounds applied, reload preserved. Mock API only.');
} catch(e) {console.error(page.url(),(await page.locator('body').innerText()).slice(-1800));throw e;}
finally {await browser.close();}
