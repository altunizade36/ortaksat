import assert from 'node:assert/strict';
import {mobileAuthFixture} from './mobile-auth-fixture.mjs';
const f=await mobileAuthFixture({verification:true});
const {page,browser,go,api,errors}=f;
let signupCalls=0,resendCalls=0,verifyCalls=0,releaseSignup,releaseResend;
await page.route(`${api}/auth/v1/signup**`,async route=>{
 signupCalls++;await new Promise(resolve=>{releaseSignup=resolve;});
 await route.fulfill({json:{user:{...f.user,identities:[{provider:'email'}]},session:null}});
});
await page.route(`${api}/auth/v1/resend**`,async route=>{
 resendCalls++;
 if(resendCalls===1)return route.fulfill({status:503,json:{message:'Local resend failure'}});
 await new Promise(resolve=>{releaseResend=resolve;});await route.fulfill({json:{}});
});
await page.route(`${api}/auth/v1/verify**`,async route=>{
 verifyCalls++;if(verifyCalls===1)return route.fulfill({status:400,json:{message:'Invalid test code'}});
 await route.fulfill({json:f.session});
});
async function until(fn){for(let i=0;i<100&&!fn();i++)await new Promise(r=>setTimeout(r,20));assert.ok(fn());}
try {
 await page.setViewportSize({width:1440,height:1000});
 await go('/auth?redirect=/create');await page.getByRole('tab',{name:'Hesap Oluştur',exact:true}).click();
 await page.getByPlaceholder('Ayşe',{exact:true}).fill('Örnek');await page.getByPlaceholder('Demir',{exact:true}).fill('Kullanıcı');
 await page.getByPlaceholder('ornek@eposta.com',{exact:true}).fill('preview@example.invalid');
 await page.getByPlaceholder('Güçlü bir şifre oluştur',{exact:true}).fill('LocalTest!2026');
 await page.getByPlaceholder('Şifreni tekrar gir',{exact:true}).fill('LocalTest!2026');
 await page.getByRole('checkbox',{name:'Yasal metinleri kabul ediyorum',exact:true}).click();
 await page.getByRole('button',{name:'Kayıt ol',exact:true}).evaluate(el=>{el.click();el.click();});
 await until(()=>releaseSignup);assert.equal(signupCalls,1);releaseSignup();
 await page.getByText('E-postanı doğrula',{exact:true}).waitFor();
 const code=page.getByPlaceholder('______',{exact:true});
 await code.fill('12');await page.getByRole('button',{name:'Doğrula ve giriş yap',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'6 haneli kodu eksiksiz'}).waitFor();assert.equal(verifyCalls,0);
 await page.getByRole('button',{name:'Kodu tekrar gönder',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Kod gönderilemedi'}).waitFor();
 assert.equal(await code.inputValue(),'12');
 await page.getByRole('button',{name:'Kodu tekrar gönder',exact:true}).evaluate(el=>{el.click();el.click();});
 await until(()=>releaseResend);assert.equal(resendCalls,2);
 assert.equal(await page.getByRole('button',{name:'Doğrula ve giriş yap',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'Vazgeç',exact:true}).isDisabled(),true);
 releaseResend();await page.getByRole('button',{name:/Tekrar gönder \(\d+ sn\)/}).waitFor();
 assert.equal(await page.getByRole('button',{name:/Tekrar gönder \(\d+ sn\)/}).isDisabled(),true);
 await code.fill('123456');await page.getByRole('button',{name:'Doğrula ve giriş yap',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Kod doğrulanamadı'}).waitFor();assert.equal(await code.inputValue(),'123456');
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
 await f.shot({path:'audit/web-review/signup-code-recovery-390.png'});
 await page.getByRole('button',{name:'Doğrula ve giriş yap',exact:true}).click();await page.waitForURL(url=>url.pathname==='/create');
 assert.equal(verifyCalls,2);assert.deepEqual(errors,[]);
 console.log('Passed signup recovery: one request on double submit, incomplete OTP blocked locally, resend failure/retry without lost code, resend single flight/cooldown, cancellation locked while busy, failed verification retains code, successful verification returns to create, 390px. Mock only.');
}catch(e){console.error(page.url(),(await page.locator('body').innerText()).slice(-2300));throw e;}finally{await browser.close();}
