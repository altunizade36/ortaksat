import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, go, api, listing, me, errors } = await mobileAuthFixture({authenticated:true});
const rows=[{partnership_mode:'open'},{partnership_mode:'approval'},{partnership_mode:'invite'},{partnership_mode:'open',status:'sold'},{partnership_mode:'open',stock_count:0}].map((fields,i)=>({...listing,id:`bbbbbbbb-bbbb-4bbb-8bbb-${String(i+1).padStart(12,'0')}`,title:`Web favori örnek ürün ${i+1}`,created_at:new Date(Date.now()-(i+1)*86400000).toISOString(),...fields}));
const favs=rows.map((r,i)=>({id:`fav-web-${i}`,listing_id:r.id,user_id:me,created_at:new Date(Date.now()-(i<2?12:5-i)*86400000).toISOString()}));
try{
  await page.route(`${api}/rest/v1/favorites**`,route=>route.fulfill({json:favs}));
  await page.route(`${api}/rest/v1/listing_public_cards**`,route=>{
    const req=route.request(),id=new URL(req.url()).searchParams.get('id')?.replace('eq.','');const found=id?rows.filter(r=>r.id===id):rows;
    return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?found[0]||null:found});
  });
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});await go('/favorites?view=collections');
    await page.getByText(rows[4].title,{exact:true}).first().waitFor();
    const titleOrder=await page.locator('body').innerText();assert.ok(titleOrder.indexOf(rows[4].title)<titleOrder.indexOf(rows[0].title),'Newest favorite is based on saved date, not listing publication');
    await page.getByRole('button',{name:width===1440?/^Ortak satışa açık\s*\(2\)$/: 'Ortak satışa açık',exact:width!==1440}).click();
    for(const i of [0,1])await page.getByText(rows[i].title,{exact:true}).first().waitFor();
    for(const i of [2,3,4])assert.equal(await page.getByText(rows[i].title,{exact:true}).count(),0);
    if(width===1440){
      await page.getByRole('button',{name:/^Tümü\s*\(5\)$/}).click();
      await page.getByRole('button',{name:/^Son eklenenler\s*\(3\)$/}).click();
      assert.equal(await page.getByText(rows[0].title,{exact:true}).count(),0);
      await page.getByText(rows[4].title,{exact:true}).first().waitFor();
      const input=page.getByRole('textbox',{name:'Favorilerde ara',exact:true});
      await input.fill('bulunmayan');await page.getByRole('button',{name:'Filtreleri Temizle',exact:true}).click();
      await page.getByText(rows[0].title,{exact:true}).first().waitFor();assert.equal(await input.inputValue(),'');
      await input.fill(rows[1].title);await page.getByText(rows[1].title,{exact:true}).first().waitFor();
      assert.equal(await page.getByText(rows[0].title,{exact:true}).count(),0);
    }
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
  }
  assert.deepEqual(errors,[]);
  await writeFile('audit/web-review/favorites-recovery-ui.json',JSON.stringify({mockOnly:true,widths:[390,1440],approvalIncluded:true,unavailableExcluded:true,savedDateSort:true,lastSevenDays:true,desktopSearchAndReset:true,errors},null,2));
  console.log('Passed web favorite eligibility, saved-date ordering, recent favorites, desktop search/reset and width limits.');
}catch(error){console.error(page.url(),(await page.locator('body').innerText()).slice(-1800));throw error;}
finally{await browser.close();}
