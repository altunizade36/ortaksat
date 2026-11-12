import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const f=await mobileAuthFixture({authenticated:true});
await f.page.route(`${f.api}/rest/v1/rpc/mobile_catalogue_page`,r=>r.fulfill({json:{listings:[f.listing],total:1}}));
try{
 await mkdir('audit/mobile-next',{recursive:true});await f.go('/explore?view=list');
 await f.page.getByRole('button',{name:/^Filtrele(?: \(\d+\))?$/}).click();
 const minimum=f.page.getByLabel('Minimum fiyat',{exact:true}),maximum=f.page.getByLabel('Maksimum fiyat',{exact:true});
 for(const knob of [minimum,maximum]){const r=await knob.boundingBox();assert.ok(r.width>=44&&r.height>=44,'44px slider targets');assert.ok(await knob.getAttribute('aria-valuenow')!==null,'Announced current price');}
 const price=f.page.getByRole('textbox',{name:'Min. Fiyat',exact:true});
 await minimum.scrollIntoViewIfNeeded();await minimum.focus();await minimum.press('ArrowRight');assert.ok(Number(await price.inputValue())>0,'Keyboard adjusts price');await minimum.press('ArrowLeft');
 const box=await minimum.boundingBox();await f.page.mouse.move(box.x+22,box.y+22);await f.page.mouse.down();await f.page.mouse.move(box.x+82,box.y+22,{steps:6});await f.page.mouse.up();
 assert.ok(Number((await price.inputValue()).replaceAll('.',''))>0,'Dragging updates the price criterion');
 assert.equal(await f.page.getByRole('button',{name:'Konumumu kullan',exact:true}).count(),0,'No unsupported browser GPS action');
 assert.deepEqual(f.errors,[]);await f.shot({path:'audit/mobile-next/filter-controls.png'});
 await writeFile('audit/mobile-next/filter-controls.json',JSON.stringify({touchTargets:44,dragChangesCriteria:true,screenReaderValue:true,unsupportedWebGpsHidden:true,errors:f.errors},null,2));
 console.log('PASS: 44px price thumbs, readable slider values, drag changes the actual filter, unsupported web GPS hidden. Synthetic data only.');
}finally{await f.browser.close();}
