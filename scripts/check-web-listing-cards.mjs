import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const engine=process.env.TEST_BROWSER||'chromium';
const f=await mobileAuthFixture({authenticated:true,browserName:engine});
const {page,browser,go,api,listing,me,errors}=f;
const rows=[
 {title:'iPhone 13 Pro 128 GB temiz ve kutulu',partnership_mode:'open',currency:'TRY',price:2350000,commission_value:5000},
 {title:'Çok uzun başlıklı geniş bahçeli müstakil villa deniz manzaralı aile yaşamına uygun bakımlı satılık konut',partnership_mode:'approval',currency:'EUR',price:2450000000,commission_value:1250000},
 {title:'Ortaklığa kapalı standart ürün',partnership_mode:'none',currency:'TRY',price:400,commission_value:400},
 {title:'Satışı tamamlanan örnek ürün',partnership_mode:'approval',status:'sold',stock_count:0,currency:'USD',price:1999,commission_type:'rate',commission_value:15},
 {title:'Davetle katılınan ortak satış ürünü',partnership_mode:'invite',currency:'USD',price:1999,commission_type:'rate',commission_value:15},
].map((x,i)=>({...listing,attributes:{},ad_assets:[listing.image_url],id:`bbbbbbbb-bbbb-4bbb-8bbb-${String(i+1).padStart(12,'0')}`,created_at:new Date().toISOString(),...x}));
const homeSource=await readFile('app/(tabs)/index.tsx','utf8');
assert.equal(homeSource.includes('width: 140'),false,'Home does not keep a separate long/mini listing card geometry');
for(const collection of ['topEarn','recentListings','newestListings']) assert.match(homeSource,new RegExp(`${collection}\\.map\\(\\(l\\) => <ListingCard`),`${collection} uses the shared listing card`);
await page.route(`${api}/rest/v1/favorites**`,r=>r.fulfill({json:rows.map((x,i)=>({id:`fav-card-${i}`,listing_id:x.id,user_id:me,created_at:new Date().toISOString()}))}));
await page.route(`${api}/rest/v1/listing_public_cards**`,r=>{
 const req=r.request(),id=new URL(req.url()).searchParams.get('id');const data=id?.startsWith('eq.')?rows.filter(x=>x.id===id.slice(3)):rows;
 return r.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?data[0]||null:data});
});
await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`,r=>r.fulfill({json:{listings:rows.filter(x=>x.status==='active'&&['open','approval'].includes(x.partnership_mode)),total:rows.filter(x=>x.status==='active'&&['open','approval'].includes(x.partnership_mode)).length}}));
await mkdir('audit/card-grid',{recursive:true});const checks=[];
try{
 await go('/');
 await page.getByTestId('mobile-web-primary-nav').getByRole('link',{name:'Menü',exact:true}).click();
 await page.getByRole('link',{name:'Favorilerim',exact:true}).click();
 await page.locator('[data-testid="listing-card"]:visible').first().waitFor();
 for(const width of [320,390,430,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  await page.mouse.move(1,1);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const cards=page.locator('[data-testid="listing-card"]:visible');assert.equal(await cards.count(),5);
  const geometry=[];
  for(const card of await cards.all()){
   const box=await card.boundingBox(),photo=await card.getByTestId('listing-card-photo').boundingBox();
   const body=await card.getByTestId('listing-card-body').boundingBox();
   const price=await card.getByTestId('listing-card-price').boundingBox();
   const commission=await card.getByTestId('listing-commission').boundingBox();
   assert.ok(box.height<300&&box.height/box.width<1.46,`Compact near-square card ${JSON.stringify(box)}`);
   assert.ok(Math.abs(photo.width/photo.height-2)<0.03);
   assert.ok(Math.abs(body.height-96)<1.1,`Body slot ${body.height}`);
   if(box.width>=190){const compare=await card.getByTestId('listing-card-footer').boundingBox();assert.ok(Math.abs(compare.width-44)<1.1&&Math.abs(compare.height-44)<1.1,`Overlay compare target ${JSON.stringify(compare)}`);}else assert.equal(await card.getByTestId('listing-card-footer').count(),0,'Narrow cards keep only the essential favorite action');
   assert.ok(await card.getByTestId('listing-card-price').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Complete price fits');
   geometry.push({width:box.width,height:box.height,priceY:price.y-box.y,commissionY:commission.y-box.y});
   const buttons=await card.getByRole('button').all();const rects=await Promise.all(buttons.map(x=>x.boundingBox()));
   for(const r of rects)assert.ok(Math.round(r.width)>=44&&Math.round(r.height)>=44,`44px targets at ${width}: ${JSON.stringify(r)}`);
   for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
    const a=rects[i],b=rects[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'Separate actions');
   }
  }
  for(const group of Map.groupBy(geometry,item=>Math.round(item.width)).values()){
   const baseline=group[0];
   for(const item of group){
    for(const key of ['height','priceY','commissionY']) assert.ok(Math.abs(item[key]-baseline[key])<1.1,`${key} aligned at ${width}: ${JSON.stringify(group)}`);
   }
  }
  const firstBox=await cards.first().boundingBox();
  await page.mouse.move(firstBox.x+firstBox.width/2,firstBox.y+20);
  await page.waitForTimeout(240);
  const hoveredBox=await cards.first().boundingBox();
  assert.ok(Math.abs(hoveredBox.y-firstBox.y)<1,`Hover keeps row line at ${width}`);
  await page.mouse.move(1,1);
  for(const row of rows){
   const card=cards.filter({has:page.getByRole('link',{name:row.title,exact:true})});
   if(row.partnership_mode==='none'||row.status==='sold')assert.equal(await card.getByTestId('listing-commission-amount').count(),0,'Unavailable listings do not advertise earnings');
   else await card.getByTestId('listing-commission-amount').waitFor();
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.getByText('Tahmini komisyon',{exact:true}).count(),0);
  if([390,1440].includes(width))await f.shot({path:`audit/card-grid/${engine}-favorites-${width}.png`,fullPage:true});
  checks.push({width,cards:5,priceFits:true,actions44:true,aspectRatio:2,alignedSlots:true,maxHeight:Math.max(...geometry.map(x=>x.height))});
 }
 const card=page.locator('[data-testid="listing-card"]:visible').first(),before=page.url();
 await card.getByRole('button',{name:'Karşılaştır',exact:true}).click();assert.equal(page.url(),before);
 await card.getByRole('button',{name:'Karşılaştırmadan çıkar',exact:true}).click();assert.equal(page.url(),before);
 await card.getByRole('link').click();await page.waitForURL(u=>u.pathname.startsWith('/listing/'));
 await page.setViewportSize({width:390,height:900});
 await page.getByTestId('mobile-web-primary-nav').getByRole('link',{name:'Keşfet',exact:true}).click();
 const tile=page.locator('[data-tile="1"]:visible').first();await tile.waitFor();
 const tileBox=await tile.boundingBox(),band=await tile.getByTestId('listing-commission').boundingBox();
 assert.ok(band.y+band.height<=tileBox.y+tileBox.height+1,'Commission fits inside explore card');
 assert.ok(tileBox.height<300&&tileBox.height/tileBox.width<1.46,`Compact explore tile ${JSON.stringify(tileBox)}`);
 assert.equal(await tile.getByText('Tahmini komisyon',{exact:true}).count(),0);
 await f.shot({path:`audit/card-grid/${engine}-explore.png`,fullPage:true});
 const tileUrl=page.url();await tile.getByRole('button',{name:'Karşılaştır',exact:true}).click();assert.equal(page.url(),tileUrl);
 await tile.getByRole('button',{name:'Karşılaştırmadan çıkar',exact:true}).click();
 await page.getByTestId('mobile-web-primary-nav').getByRole('link',{name:'Ortak Satış',exact:true}).click();
 const opportunity=page.getByTestId('partnership-listing-card').filter({visible:true}).first();await opportunity.waitFor();
 await opportunity.getByTestId('listing-commission-amount').waitFor();
 const partnerBox=await opportunity.boundingBox();assert.ok(partnerBox.width<=220&&partnerBox.height<300&&partnerBox.height/partnerBox.width<1.46,`Compact partner card ${JSON.stringify(partnerBox)}`);
 assert.equal(await opportunity.getByText('Tahmini komisyon',{exact:true}).count(),0);
 await f.shot({path:`audit/card-grid/${engine}-partner.png`,fullPage:true});
 await opportunity.getByRole('link').click();
 await page.waitForURL(u=>u.pathname.startsWith('/listing/'));
 const homeConsistency=[];
 for(const width of [390,1440]){
  await page.evaluate(()=>localStorage.clear());await page.setViewportSize({width,height:900});await go('/');
  const homeCards=page.getByTestId('listing-card');await homeCards.first().waitFor();
  const boxes=await Promise.all((await homeCards.all()).map(item=>item.boundingBox()));assert.ok(boxes.length>=4,'Homepage renders compact shared cards');
  const widths=[...new Set(boxes.map(box=>Math.round(box.width)))];assert.equal(widths.length,1,`Home carousels and marketplace use one card width at ${width}: ${widths}`);
  assert.ok(boxes.every(box=>box.height<300&&box.height/box.width<1.46));
  homeConsistency.push({width,cards:boxes.length,cardWidth:widths[0],sameGeometry:true});
 }
 assert.deepEqual(errors,[]);
 await writeFile(`audit/card-grid/${engine}-checks.json`,JSON.stringify({engine,checks,homeConsistency,comparisonDoesNotNavigate:true,detailsOpen:true,exploreCard:true,partnershipCard:{width:partnerBox.width,height:partnerBox.height},partnershipDetailOpens:true,commissionLabel:'Komisyon',errors,mockedBackend:true},null,2));
 console.log(`${engine}: five listing modes/currencies, six viewport sizes, aligned fixed slots, full prices, compact cards, independent 44px actions and detail navigation passed. Mocked backend only.`);
}catch(error){await f.shot({path:`audit/card-grid/${engine}-failure.png`,fullPage:true}).catch(()=>{});console.error(page.url(),(await page.locator('body').innerText()).slice(-1200));throw error;}finally{await browser.close();}
