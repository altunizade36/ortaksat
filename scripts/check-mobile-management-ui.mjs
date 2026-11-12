import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
await mkdir('audit/mobile-v3', {recursive:true});
const f=await mobileAuthFixture({authenticated:true});
const {browser,page,api,me,seller,listing,errors,go,shot}=f;
const now=new Date().toISOString(), image=listing.image_url;
const own={...listing,owner_id:me,title:'Yönetilen BMW 320i M Sport',description:'Yerel test için ayrıntılı ve yeterli uzunlukta araç açıklaması.',province_id:34,district_id:34028,demo:false,ad_assets:[image+'?second'],attributes:{_root:'Vasıta',_leaf:'Diğer Model',_formKey:'otomobil',brand:'BMW',model:'Diğer Model',condition:'İkinci El',inspection:'Var',year:'2021',km:62000,fuel:'Benzin',gear:'Otomatik',_maxPartners:5}};
const favorite={...own,id:'77777777-7777-4777-8777-777777777777',owner_id:seller,title:'Kaydedilen iPhone 15 Pro',price:45000,category:'Telefon',attributes:{_root:'Elektronik',_formKey:'telefon'}};
let rows=[own,favorite],favRows=[{id:'88888888-8888-4888-8888-888888888888',listing_id:favorite.id,user_id:me,saved_price:50000,created_at:now}];
let failSave=true,failDelete=true,failFavorite=true,failStatus=true;
const writes=[];
try{
 await page.route(`${api}/rest/v1/**`,async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').at(-1);let data;
  if(table==='listing_public_cards'){
   const owner=u.searchParams.get('owner_id');data=owner?rows.filter(l=>`eq.${l.owner_id}`===owner):rows;
  }else if(table==='listings'&&req.method()==='PATCH'){
   const body=req.postDataJSON();writes.push({table,body});
   if(failSave&&body.title||failStatus&&Object.keys(body).length===1){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Local failure'})});return;}
   const id=u.searchParams.get('id')?.replace('eq.','');rows=rows.map(l=>l.id===id?{...l,...body}:l);data=[{id}];
  }else if(table==='listings'&&req.method()==='GET')data=[];
  else if(table==='favorites'){
   if(req.method()==='DELETE'){writes.push({table,method:'DELETE'});if(failFavorite){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Local favorite failure'})});return;}favRows=[];data=null;}else data=favRows;
  }else if(table==='remove_listing'){writes.push({table});if(failDelete){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Local deletion failure'})});return;}rows=rows.filter(l=>l.id!==own.id);data='deleted';}
  else {await route.fallback();return;}
  const single=req.headers().accept?.includes('vnd.pgrst.object');
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(single&&Array.isArray(data)?data[0]||null:data)});
 });
 await go('/seller');await page.getByText(own.title,{exact:true}).waitFor({timeout:60000});
 await shot({path:'audit/mobile-v3/my-listings-390.png'});
 await page.getByRole('button',{name:'Yayından Kaldır',exact:true}).click();await page.getByRole('button',{name:'Onayla',exact:true}).click();
 await page.getByText('İlan durumu kaydedilemedi. Tekrar dene.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Yayından Kaldır',exact:true}).waitFor();
 failStatus=false;
 await page.getByRole('button',{name:'Yayından Kaldır',exact:true}).click();await page.getByRole('button',{name:'Onayla',exact:true}).click();
 await page.getByRole('button',{name:'Yeniden Yayınla',exact:true}).waitFor();
 await page.getByRole('button',{name:'Düzenle',exact:true}).click();
 await page.getByRole('button',{name:'Kategori: Vasıta / Otomobil / BMW / Diğer Model',exact:true}).waitFor();
 const beforeInvalid=writes.length;
 await page.getByRole('textbox',{name:'Başlık',exact:true}).fill('*** BMW 320i ***');
 await page.getByRole('button',{name:'Önizle',exact:true}).click();
 assert.equal(await page.getByText('İlan Önizleme',{exact:true}).count(),0,'Invalid title cannot advance to preview');
 assert.equal(writes.length,beforeInvalid,'Invalid title cannot write');
 await page.getByRole('textbox',{name:'Başlık',exact:true}).fill('Düzenlenmiş BMW 320i M Sport');
 await page.getByRole('button',{name:'Önizle',exact:true}).click();
 await page.getByText('İlan Önizleme',{exact:true}).waitFor();
 await shot({path:'audit/mobile-v3/listing-preview-390.png'});
 await page.getByRole('button',{name:'Değişiklikleri Kaydet',exact:true}).click();
 await page.getByText('Değişiklikler kaydedilemedi. Bilgilerin bu ekranda korunuyor; tekrar dene.',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).pathname,`/listing-edit/${own.id}`);
 failSave=false;
 await page.getByRole('button',{name:'Değişiklikleri Kaydet',exact:true}).click();
 await page.getByRole('heading',{name:'İlanlarım',exact:true}).waitFor();
 await page.getByText('Düzenlenmiş BMW 320i M Sport',{exact:true}).filter({visible:true}).waitFor();
 assert.ok(writes.some(w=>w.table==='listings'&&w.body.attributes?._maxPartners===5));
 await page.getByRole('button',{name:'Sil',exact:true}).click();await page.getByRole('button',{name:'Sil',exact:true}).last().click();
 await page.getByText('İlan kaldırılamadı. Tekrar dene.',{exact:true}).waitFor();
 await page.getByText('Düzenlenmiş BMW 320i M Sport',{exact:true}).filter({visible:true}).waitFor();
 await go('/favorites');await page.getByText(favorite.title,{exact:true}).waitFor();
 await page.getByText('↓ %10',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Son Eklenen (1)',exact:true}).click();
 await page.getByText(favorite.title,{exact:true}).waitFor();
 await shot({path:'audit/mobile-v3/favorites-390.png'});
 await page.getByRole('button',{name:`${favorite.title} favorilerden kaldır`,exact:true}).click();
 await page.getByText('Favori kaldırılamadı. Tekrar dene.',{exact:true}).waitFor();
 await page.getByText(favorite.title,{exact:true}).waitFor();
 failFavorite=false;
 await page.getByRole('button',{name:`${favorite.title} favorilerden kaldır`,exact:true}).click();
 await page.getByText('Bu görünümde favori bulunamadı',{exact:true}).waitFor();
 await page.setViewportSize({width:320,height:740});await go(`/listing-edit/${own.id}`);
 await page.getByRole('textbox',{name:'Başlık',exact:true}).waitFor();await shot({path:'audit/mobile-v3/listing-editor-320.png'});
 assert.equal(errors.length,0,JSON.stringify(errors));
 await writeFile('audit/mobile-v3/management-ui-test.json',JSON.stringify({mockOnly:true,statusFailurePreservesListing:true,saveFailurePreservesForm:true,save:true,deleteFailurePreservesListing:true,favoriteFailureRollsBack:true,favoriteRemoval:true,savedDateFilter:true,priceChange:true,errors},null,2));
 console.log('Passed: management screens, preview/save, error recovery for status/delete/favorites, saved-date filter and price-change calculation.');
}catch(error){console.error((await page.locator('body').innerText()).slice(0,3500));throw error;}finally{await browser.close();}
