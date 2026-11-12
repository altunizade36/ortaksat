import assert from 'node:assert/strict';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const f=await mobileAuthFixture({authenticated:true});const{page,browser,go,api,listing,me,seller,shot,errors}=f;
const own={...listing,id:'77777777-7777-4777-8777-777777777777',owner_id:me,title:'Yönetilen Ortak İlanı'};
let p={id:'66666666-6666-4666-8666-666666666666',listing_id:own.id,partner_id:seller,ref_code:'sample',status:'pending',note:'Bu ilan için alıcı bulabilirim.',created_at:new Date().toISOString()},fail=true;const queries=[];
try{
 await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`,async route=>{const params=route.request().postDataJSON().params;if(params.limit!==1)queries.push(params);await route.fulfill({json:{listings:[listing,own],total:2}});});
 await page.route(`${api}/rest/v1/listing_public_cards**`,async route=>route.fulfill({json:[listing,own]}));
 await page.route(`${api}/rest/v1/partnerships**`,async route=>{if(route.request().method()==='PATCH'){if(fail){await route.fulfill({status:503,json:{message:'Local failure'}});return;}p={...p,...route.request().postDataJSON()};await route.fulfill({json:{id:p.id}});return;}await route.fulfill({json:[p]});});
 await go('/partner');await page.getByTestId('partnership-listing-card').first().waitFor();
 assert.equal(queries.at(-1).filters.open,true);await page.getByText('Komisyon',{exact:true}).first().waitFor();
 const cards390=await page.getByTestId('partnership-listing-card').all();
 const boxes390=await Promise.all(cards390.slice(0,2).map(card=>card.boundingBox()));
 assert.ok(boxes390.every(Boolean));assert.ok(Math.abs(boxes390[0].y-boxes390[1].y)<2);assert.ok(Math.abs(boxes390[0].height-boxes390[1].height)<2);assert.ok(boxes390[0].width<=210);
 await shot({path:'audit/mobile-v4/partner-grid-390.png'});
 await page.getByRole('button',{name:'Yüksek Komisyon',exact:true}).click();await page.waitForTimeout(400);assert.equal(queries.at(-1).sort,'commission');
 await page.getByRole('button',{name:'Filtrele',exact:true}).click();await page.getByRole('textbox',{name:'Min. Fiyat',exact:true}).fill('10000');await page.getByRole('button',{name:'Vazgeç',exact:true}).click();assert.equal(queries.at(-1).filters.min,'');
 await page.getByRole('button',{name:'Filtrele',exact:true}).click();await page.getByRole('textbox',{name:'Min. Fiyat',exact:true}).fill('10000');await page.getByRole('button',{name:/2 ilan göster/}).click();await page.waitForTimeout(500);assert.equal(queries.at(-1).filters.min,'10000');assert.equal(queries.at(-1).filters.open,true);
 await page.getByRole('button',{name:'Talepler',exact:true}).click();await page.getByRole('button',{name:'Onayla',exact:true}).click();await page.getByRole('alert').filter({hasText:'Talep güncellenemedi'}).waitFor();assert.equal(p.status,'pending');await page.getByRole('button',{name:'Onayla',exact:true}).waitFor();
 fail=false;await page.getByRole('button',{name:'Onayla',exact:true}).click();await page.getByRole('button',{name:'Detayı Gör',exact:true}).waitFor();assert.equal(p.status,'active');
 await page.getByRole('button',{name:'Detayı Gör',exact:true}).click();await page.getByText('Aktif Ortaklık',{exact:true}).waitFor();
 await page.setViewportSize({width:320,height:740});await go('/partner');await page.getByTestId('partnership-listing-card').first().waitFor();
 const cards320=await page.getByTestId('partnership-listing-card').all();const boxes320=await Promise.all(cards320.slice(0,2).map(card=>card.boundingBox()));
 assert.ok(boxes320.every(Boolean));assert.ok(Math.abs(boxes320[0].y-boxes320[1].y)<2);assert.ok(Math.abs(boxes320[0].height-boxes320[1].height)<2);assert.ok(boxes320[0].width<=160);
 await shot({path:'audit/mobile-v4/partner-grid-320.png'});
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('Passed isolated partnership UI: responsive grid, commission ordering, filter apply/cancel, forced open-only filter, failed approval retained, persisted approval and actual-status detail.');
}catch(error){console.error(page.url(),(await page.locator('body').innerText()).slice(0,2200));throw error;}finally{await browser.close();}
