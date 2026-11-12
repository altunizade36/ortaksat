import assert from 'node:assert/strict';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const f=await mobileAuthFixture({authenticated:true});
const {page,browser,go,errors,writes,api,listing,shot}=f;
try {
 await go('/create');
 const input=page.getByRole('textbox',{name:'Başlık',exact:true});
 await input.fill('⫷⫷PANORAMİK BOĞAZ MANZARALI ARSA⫸⫸');
 await page.getByRole('alert').filter({hasText:'Başlıkta emoji, ok'}).waitFor();
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});
  await input.fill('A'.repeat(71));
  await page.getByText('Başlık en fazla 70 karakter olabilir. Lütfen kısaltın.',{exact:true}).waitFor();
  assert.equal(await input.inputValue(),'A'.repeat(71),'Do not silently truncate a paste');
  assert.equal(await page.getByTestId('title-counter').innerText(),'71/70');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
  await input.fill('İstanbul 2+1 daire, 120 m²');
  assert.equal(await page.getByRole('alert').filter({hasText:'Başlık'}).count(),0);
  if(width===390)await shot({path:'audit/mobile-v4/title-valid-390.png'});
 }
 await input.fill('iPhone 13 🔥');
 await shot({path:'audit/mobile-v4/title-warning-web.png'});
 await page.route(`${api}/rest/v1/rpc/mobile_partner_activity`,async route=>route.fulfill({json:{total:1,events:[{id:'title-case',listingId:listing.id,kind:'approved',title:'⫷⫷PANORAMİK BOĞAZ MANZARALI 433 M2 MÜSTAKİL ARSA⫸⫸',createdAt:'2026-10-23T12:00:00Z'}]}}));
 await page.setViewportSize({width:390,height:844});
 await go('/mobile-tools?mode=activity');
 await page.getByText('PANORAMİK BOĞAZ MANZARALI 433 M2 MÜSTAKİL ARSA',{exact:true}).waitFor();
 assert.ok(!(await page.locator('body').innerText()).includes('⫷'));
 await shot({path:'audit/mobile-v4/title-legacy-activity-390.png'});
 assert.equal(writes.filter(w=>w.table==='listings').length,0);
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('Passed title form: invalid decoration/emoji, 71-char paste retained and blocked, live counter, valid Turkish/technical punctuation, 320/390/1440px and cleaned legacy activity. No live writes.');
} catch(e){console.error(page.url(),(await page.locator('body').innerText()).slice(0,2500));throw e;}finally{await browser.close();}
