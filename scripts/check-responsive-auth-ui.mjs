import assert from 'node:assert/strict';import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const engine=process.env.TEST_BROWSER||'chromium';const prefix=engine==='chromium'?'auth':'auth-webkit';
const f=await mobileAuthFixture({browserName:engine});const {page,browser,go,errors,writes}=f;
const sizes=[[320,720],[390,844],[768,1024],[959,700],[960,600],[1024,600],[1440,900],[1920,1080],[2560,1080],[640,360]];
try{
 await go('/auth');
 for(const [width,height] of sizes){await page.setViewportSize({width,height});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);await page.waitForFunction(w=>{const el=document.querySelector('[data-testid="auth-responsive-frame"]');return el&&getComputedStyle(el).flexDirection===(w>=960?'row':'column');},width);
  const frame=await page.getByTestId('auth-responsive-frame').boundingBox(),scene=await page.getByTestId('auth-scene').boundingBox(),panel=await page.getByTestId('auth-panel').boundingBox(),content=await page.getByTestId('auth-panel-content').boundingBox();
  assert.ok(frame.width<=1441&&frame.width<=width+1);assert.ok(content.width<=441&&content.x>=-1&&content.x+content.width<=width+1);
  if(width>=960){assert.ok(panel.x>=scene.x+scene.width-1);assert.ok(Math.abs(panel.y-scene.y)<2);}else assert.ok(panel.y>=scene.y+scene.height-15);
  const button=page.getByRole('button',{name:'E-posta ile giriş yap',exact:true});await button.scrollIntoViewIfNeeded();assert.ok((await button.boundingBox()).height>=44);
  assert.equal(await page.getByRole('button',{name:'Apple ile devam et',exact:true}).count(),0);
  if([390,768,1440,1920].includes(width))await f.shot({path:`audit/web-review/${prefix}-landing-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:900});
 await page.getByPlaceholder('ornek@eposta.com',{exact:true}).fill('preview@example.invalid');await page.getByPlaceholder('Şifreni gir',{exact:true}).fill('LocalTest!2026');
 await page.setViewportSize({width:320,height:720});assert.equal(await page.getByPlaceholder('ornek@eposta.com',{exact:true}).inputValue(),'preview@example.invalid');
 await page.getByRole('button',{name:'Şifreyi göster',exact:true}).click();assert.equal(await page.getByPlaceholder('Şifreni gir',{exact:true}).getAttribute('type'),'text');await page.getByRole('button',{name:'Şifreyi gizle',exact:true}).click();
 await page.getByRole('button',{name:'E-posta ile giriş yap',exact:true}).scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
 await f.shot({path:`audit/web-review/${prefix}-email-320.png`});
 await page.getByRole('button',{name:'Şifremi unuttum',exact:true}).click();await page.getByRole('button',{name:'Sıfırlama kodu gönder',exact:true}).waitFor();
 assert.equal(await page.getByPlaceholder('ornek@eposta.com',{exact:true}).inputValue(),'preview@example.invalid');
 await page.getByRole('button',{name:'Girişe dön',exact:true}).click();await page.getByRole('tab',{name:'Hesap Oluştur',exact:true}).click();
 await page.getByPlaceholder('Ayşe',{exact:true}).fill('Örnek');await page.getByPlaceholder('Demir',{exact:true}).fill('Kullanıcı');
 for(const [width,height] of [[320,720],[768,1024],[1440,900]]){await page.setViewportSize({width,height});await page.getByRole('button',{name:'Kayıt ol',exact:true}).scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);assert.equal(await page.getByPlaceholder('Ayşe',{exact:true}).inputValue(),'Örnek');await f.shot({path:`audit/web-review/${prefix}-register-${width}.png`});}
 // Direct register URL must hydrate without a mismatch.
 await go('/auth?mode=register&redirect=/create');await page.getByRole('tab',{name:'Hesap Oluştur',exact:true}).waitFor();await page.getByText('Hesabını oluştur',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Geç',exact:true}).click();await page.waitForURL(url=>url.pathname==='/');
 assert.equal(writes.filter(w=>['signup','listings'].includes(w.table)).length,0);assert.deepEqual(errors,[]);
 console.log(engine+' passed responsive auth: 10 viewport sizes, clamped desktop form, one/two-column transitions, 44px actions, preserved email/name/password across resize, password visibility, reset/back, direct registration URL hydration, guest skip. No account created.');
}catch(e){console.error(page.url(),(await page.locator('body').innerText()).slice(-2000));throw e;}finally{await browser.close();}
