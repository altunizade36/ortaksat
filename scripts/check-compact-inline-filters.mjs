import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const engine=process.env.TEST_BROWSER||'chromium';
const f=await mobileAuthFixture({browserName:engine});
const {page,go,browser,errors}=f,checks=[];
await mkdir('audit/compact-filters',{recursive:true});
async function compact(){
 const box=await page.getByTestId('compact-filter-panel').boundingBox();
 assert.ok(box.height<=345,`Inline filter height ${box.height}`);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.equal(await page.locator('[aria-modal="true"]').count(),0,'Filter must stay inline');
 return box;
}
try{
 for(const width of [320,390,430,768]){
  await page.setViewportSize({width,height:800});
  await go('/');
  await page.getByRole('button',{name:'Gelişmiş filtre',exact:true}).click();
  await compact();
  const min=page.getByPlaceholder('En az',{exact:true}),max=page.getByPlaceholder('En çok',{exact:true});
  await min.fill('1000');await max.fill('5000');
  for(const group of ['Konum','Kategori','Komisyon','Diğer','Fiyat']){
   await page.getByRole('button',{name:`${group} filtresi`,exact:true}).click();await compact();
   if(group==='Konum'&&width===390){
    await page.getByRole('button',{name:'İl: Tüm iller',exact:true}).click();
    await page.getByText('İstanbul',{exact:true}).click();
    await page.getByRole('button',{name:'İlçe: Tüm ilçeler',exact:true}).click();
    await page.getByText('Kadıköy',{exact:true}).click();
    await compact();
   }
  }
  assert.equal(await min.inputValue(),'1000');assert.equal(await max.inputValue(),'5000');
  await f.shot({path:`audit/compact-filters/${engine}-home-${width}.png`});
  await page.getByRole('button',{name:'Filtreyi kapat',exact:true}).click();
  assert.equal(await page.getByTestId('compact-filter-panel').count(),0);
  await page.getByRole('button',{name:'Gelişmiş filtre',exact:true}).click();
  assert.equal(await min.inputValue(),'1000');
  await page.getByRole('button',{name:'Filtreleri temizle',exact:true}).click();
  assert.equal(await min.inputValue(),'');assert.equal(await max.inputValue(),'');
  await page.getByRole('button',{name:'Filtreyi kapat',exact:true}).click();
  await page.getByTestId('mobile-web-primary-nav').getByRole('link',{name:'Keşfet',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/explore');
  await page.getByRole('button',{name:'Filtrele',exact:true}).click();
  await compact();
  await page.getByRole('textbox',{name:'Minimum fiyat',exact:true}).fill('50000');
  await page.getByRole('textbox',{name:'Maksimum fiyat',exact:true}).fill('2500000');
  await page.getByText('Uygula',{exact:true}).click();
  await page.getByRole('button',{name:'Konum filtresi',exact:true}).click();await compact();
  await page.getByRole('button',{name:'Fiyat filtresi',exact:true}).click();
  assert.match(await page.getByRole('textbox',{name:'Minimum fiyat',exact:true}).inputValue(),/50[.\s]?000/);
  await f.shot({path:`audit/compact-filters/${engine}-explore-${width}.png`});
  await page.getByRole('button',{name:'İlanlara dön',exact:true}).click();
  assert.equal(await page.getByTestId('compact-filter-panel').count(),0);
  checks.push({width,height:800,home:true,explore:true,maxHeight:345,draftsRetained:true,clear:true,inline:true});
 }
 await page.setViewportSize({width:1440,height:900});await page.getByText('Sırala:',{exact:true}).last().waitFor();
 assert.equal(await page.getByTestId('compact-filter-panel').count(),0);
 assert.deepEqual(errors,[]);assert.equal(f.writes.length,0);
 await writeFile(`audit/compact-filters/${engine}-checks.json`,JSON.stringify({engine,checks,desktopUnchanged:true,errors,writes:0},null,2));
 console.log(`${engine}: inline home/explore filters, four widths, bounded height, all groups reachable, price values retained, reset/close and desktop layout passed. No backend writes.`);
}catch(error){console.error(page.url(),(await page.locator('body').innerText()).slice(-1500));throw error;}finally{await browser.close();}
