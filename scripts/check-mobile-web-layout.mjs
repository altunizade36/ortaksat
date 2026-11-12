import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';

// Static Expo export with the same clean/dynamic paths as Vercel. Local files
// only; the fixture intercepts all Supabase traffic and uses synthetic accounts.
const root=resolve(process.env.MOBILE_WEB_DIST||'dist-web'),config=JSON.parse(await readFile('vercel.json','utf8'));
if(!root.startsWith(resolve('.')+sep))throw Error('Use a local export inside the workspace');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try {
  let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  async function findFile(p){const file=resolve(root,'.'+p);if(file!==root&&!file.startsWith(root+sep))return;
   for(const candidate of [file,file+'.html',resolve(file,'index.html')])if(await stat(candidate).then(s=>s.isFile()).catch(()=>false))return candidate;
  }
  // Vercel serves an existing generated category page before fallback rewrites.
  // Serving [slug].html for a generated /kategori/emlak page changes its SSR
  // params and creates an artificial hydration mismatch in the local harness.
  let selected=await findFile(path);
  if(!selected)for(const r of config.rewrites||[]){const re=new RegExp('^'+r.source.replace(/:[^/]+/g,'[^/]+')+'$');if(re.test(path)){selected=await findFile(r.destination);break;}}
  if(!selected){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(selected)]||'application/octet-stream'});res.end(await readFile(selected));
 }catch{res.writeHead(500);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
process.env.MOBILE_TEST_URL=`http://127.0.0.1:${server.address().port}`;
const browserName=process.env.TRUST_TEST_BROWSER||'chromium';
const f=await mobileAuthFixture({authenticated:true,browserName});
const checks=[];let emptyCatalogue=false;
await mkdir('audit/mobile-web-nov5',{recursive:true});
await f.page.route(`${f.api}/rest/v1/rpc/mobile_catalogue_page`,r=>r.fulfill({json:{listings:emptyCatalogue?[]:[f.listing],total:emptyCatalogue?0:1}}));
try {
 for(const width of [320,390,430,768,1024,1440]){
  await f.page.setViewportSize({width,height:900});
  for(const path of ['/','/explore','/partner','/favorites','/hakkimizda','/kategori/emlak',`/listing/${f.listingId}`]){
   await f.go(path);
   assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} ${path}: page overflow`);
   if(width<760&&path==='/explore'){
    for(const id of ['explore-feed-filters','explore-category-filters']){const strip=f.page.getByTestId(id);await strip.waitFor();assert.ok((await strip.boundingBox()).height<=52,`${id} stays one row`);}
    const card=f.page.locator('[data-tile="1"]').first();await card.waitFor();
    const bounds=await card.boundingBox();assert.ok(bounds.y<500,`First listing visible before 500px at ${width}: ${bounds.y}`);
    await card.getByText('₺2.350.000',{exact:true}).waitFor();
    const buttons=await card.getByRole('button').all();const rects=await Promise.all(buttons.map(b=>b.boundingBox()));
    for(const r of rects)assert.ok(r.width>=44&&r.height>=44,'Card actions have 44px touch targets');
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'Card action targets do not overlap');}
    if(width===390){const url=f.page.url();await card.getByRole('button',{name:'Karşılaştır',exact:true}).click();assert.equal(f.page.url(),url,'Card action does not open the listing');await card.getByRole('button',{name:'Karşılaştırmadan çıkar',exact:true}).click();}
    checks.push({width,path,firstListingY:bounds.y,touchTargets:rects.length});
   }else checks.push({width,path,overflow:false});
   if(width<1024&&path==='/kategori/emlak'){
    for(const id of ['category-children','category-roots'])assert.ok((await f.page.getByTestId(id).boundingBox()).height<=48,'Category links remain a compact row');
    const intro=f.page.getByRole('button',{name:'Kategori hakkında',exact:true});await intro.click();await f.page.getByRole('button',{name:'Daha az göster',exact:true}).click();
   }
   if([390,1440].includes(width))await f.shot({path:`audit/mobile-web-nov5/${browserName}-${width}-${path.split('/')[1]||'home'}.png`});
   if(width<760&&path==='/favorites')assert.equal(await f.page.getByTestId('compact-footer').count(),1,'Favorites has one compact footer');
  }
 }
 await f.page.setViewportSize({width:320,height:740});await f.go('/explore');
 await f.page.getByRole('button',{name:'Tüm kategoriler',exact:true}).click();
 await f.page.getByText('Kategoriye göre filtrele',{exact:true}).waitFor();
 await f.page.getByRole('button',{name:'Tüm kategoriler',exact:true}).click();
 await f.page.getByText('Kategoriye göre filtrele',{exact:true}).waitFor({state:'hidden'});
 emptyCatalogue=true;await f.go('/partner');await f.page.getByText('Bu filtrelerde ilan bulunamadı',{exact:true}).waitFor();
 await f.go('/kategori/moda');assert.equal(await f.page.getByTestId('listing-card').count(),0,'Empty category does not fabricate listings');
 assert.ok((await f.page.getByTestId('category-roots').boundingBox()).height<=48,'Empty category links do not stretch vertically');
 assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(f.errors,[]);
 await writeFile(`audit/mobile-web-nov5/${browserName}-checks.json`,JSON.stringify({checks,categoryToggle:true,emptyPartnership:true,errors:f.errors,syntheticOnly:true},null,2));
 console.log(`PASS ${browserName}: 42 route/viewport combinations; single-row filters, visible listings, distinct 44px card actions, category toggle, empty partnership, compact footer, no page exceptions. Synthetic local data only.`);
}finally{await f.browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
