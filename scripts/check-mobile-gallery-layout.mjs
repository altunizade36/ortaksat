import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const f=await mobileAuthFixture({authenticated:true});
const base=process.env.MOBILE_TEST_URL||'http://localhost:8088';
f.listing.ad_assets=[1,2,3,4].map(i=>`${base}/demo/001-bmw-3-20i-premium-line.jpg?gallery-test=${i}`);
try{
 await mkdir('audit/mobile-next',{recursive:true});
 await f.go(`/listing/${f.listingId}`);
 await f.page.getByRole('button',{name:'Fotoğraf 3',exact:true}).click();
 await f.page.getByTestId('listing-gallery-counter').getByText('3/5',{exact:true}).waitFor();
 const checks=[];
 for(const width of [740,320,430]){
  await f.page.setViewportSize({width,height:900});
  await f.page.waitForFunction(()=>{const gallery=document.querySelector('[aria-label="Fotoğrafı büyüt 3"]');if(!gallery)return false;let scroll=gallery.parentElement;while(scroll&&!['auto','scroll'].includes(getComputedStyle(scroll).overflowX))scroll=scroll.parentElement;if(!scroll)return false;const r=gallery.getBoundingClientRect();return Math.abs(r.x-scroll.getBoundingClientRect().x)<2&&r.width>100;});
  await f.page.getByTestId('listing-gallery-counter').getByText('3/5',{exact:true}).waitFor();
  assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  checks.push({width,selectedPhoto:3});
 }
 await f.shot({path:'audit/mobile-next/gallery-430.png'});
 assert.deepEqual(f.errors,[]);
 await writeFile('audit/mobile-next/gallery-checks.json',JSON.stringify({checks,errors:f.errors,syntheticOnly:true},null,2));
 console.log('PASS: selected gallery photo remains aligned at tablet/320/430 widths, correct counter, no overflow or page exceptions. Synthetic data only.');
}finally{await f.browser.close();}
