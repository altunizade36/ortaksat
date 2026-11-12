import assert from 'node:assert/strict';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const f = await mobileAuthFixture({authenticated:true});
const {page,browser,go,api,me,shot,errors} = f;
let fail = true, failProfile = true, failReply = true;
const replies=[];
const tickets = [{id:'55555555-5555-4555-8555-555555555555', user_id:me, subject:'İlan düzenleme sorunu', message:'Yerel test için örnek destek açıklaması.', status:'reviewing',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}];
try {
 await page.route(`${api}/rest/v1/profiles**`,async route=>{
  if(route.request().method()!=='PATCH'){await route.fallback();return;}
  await route.fulfill({status:failProfile?503:200,contentType:'application/json',body:JSON.stringify(failProfile?{message:'Local profile failure'}:null)});
 });
 await page.route(`${api}/rest/v1/support_tickets**`, async route => {
  const req=route.request(),url=new URL(req.url());
  if(req.method()==='POST'){
   if(fail) {await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Local test failure'})});return;}
   tickets.unshift({...req.postDataJSON(),status:'open',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
   await route.fulfill({status:201,contentType:'application/json',body:'null'});return;
  }
  const status=url.searchParams.get('status')?.replace('eq.',''),rows=tickets.filter(t=>!status||t.status===status);
  await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`,'access-control-expose-headers':'content-range'},body:JSON.stringify(rows)});
 });
 await page.route(`${api}/rest/v1/support_messages**`,async route=>{const req=route.request();if(req.method()==='POST'){if(failReply){await route.fulfill({status:503,json:{message:'Local reply failure'}});return;}replies.push({...req.postDataJSON(),is_staff:false,created_at:new Date().toISOString()});await route.fulfill({json:null});return;}await route.fulfill({json:replies});});
 await go('/account-settings');await page.getByRole('heading',{name:'Hesap Ayarları',exact:true}).waitFor();
 await shot({path:'audit/mobile-v3/account-settings-390.png'});
 await page.getByRole('button',{name:'Destek Taleplerim',exact:true}).click();
 await page.getByRole('button',{name:'İnceleniyor (1)',exact:true}).waitFor();
 await page.getByRole('button',{name:'İlan düzenleme sorunu',exact:true}).click();
 await page.getByText(tickets[0].message,{exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Yanıtınız',exact:true}).fill('Destek yanıtı kapanıp açılınca korunmalı.');
 await page.getByRole('button',{name:'İlan düzenleme sorunu',exact:true}).click();await page.getByRole('textbox',{name:'Yanıtınız',exact:true}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'İlan düzenleme sorunu',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Yanıtınız',exact:true}).inputValue(),'Destek yanıtı kapanıp açılınca korunmalı.');
 await page.getByRole('button',{name:'Yanıtı Gönder',exact:true}).click();await page.getByRole('alert').filter({hasText:'Yanıt gönderilemedi'}).waitFor();assert.equal(replies.length,0);failReply=false;
 await page.getByRole('button',{name:'Yanıtı Gönder',exact:true}).click();await page.getByRole('button',{name:'İlan düzenleme sorunu',exact:true}).waitFor();await page.getByRole('textbox',{name:'Yanıtınız',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Yanıtınız',exact:true}).inputValue(),'');assert.equal(replies.length,1);
 await page.getByRole('button',{name:'Yeni Talep',exact:true}).click();
 await page.getByRole('button',{name:'Talep Kategorisi *: Seçin',exact:true}).click();
 await page.getByRole('button',{name:'Teknik Hata',exact:true}).click();
 await page.getByRole('textbox',{name:'Konu Başlığı',exact:true}).fill('Örnek teknik hata');
 await page.getByRole('textbox',{name:'Açıklama',exact:true}).fill('Yerel testte karşılaşılan teknik sorunun ayrıntılı açıklaması.');
 await page.getByRole('button',{name:'Talebi Gönder',exact:true}).click();
 await page.getByText('Talep gönderilemedi. Yazdıkların korunuyor; tekrar dene.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'Konu Başlığı',exact:true}).inputValue(),'Örnek teknik hata');
 fail=false;await page.getByRole('button',{name:'Talebi Gönder',exact:true}).click();
 await page.getByRole('button',{name:'Tümü (2)',exact:true}).waitFor();
 await page.getByRole('button',{name:'Örnek teknik hata',exact:true}).waitFor();
 await shot({path:'audit/mobile-v3/support-tickets-390.png'});
 await go('/sss');await page.getByRole('heading',{name:'Yardım Merkezi',exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Sorularında ara…',exact:true}).fill('zorunlu referans');
 await page.getByRole('button',{name:'Zorunlu referans linki veya takip sistemi var mı?',exact:true}).click();
 await page.getByText(/zorunlu link\/kod veya takip sistemi yoktur/).waitFor();
 assert.equal(errors.length,0,JSON.stringify(errors));
 await shot({path:'audit/mobile-v3/help-center-390.png'});
 await go('/profile-edit');
 await page.getByRole('textbox',{name:'Ad Soyad',exact:true}).fill('Düzenlenmiş Örnek Kullanıcı');
 await page.getByRole('button',{name:'Değişiklikleri Kaydet',exact:true}).click();
 await page.getByText('Profil kaydedilemedi. Değişikliklerin bu ekranda korunuyor; tekrar dene.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'Ad Soyad',exact:true}).inputValue(),'Düzenlenmiş Örnek Kullanıcı');
 await shot({path:'audit/mobile-v3/profile-editor-390.png'});
 failProfile=false;await page.getByRole('button',{name:'Değişiklikleri Kaydet',exact:true}).click();
 await page.waitForURL('**/profile');
 await page.getByText('Düzenlenmiş Örnek Kullanıcı',{exact:true}).filter({visible:true}).waitFor();
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('Passed: account settings, support list/counts/details, failed submission preserves input, retry saves one ticket, help search/accordion, profile failed save preserves form and retry succeeds. All API traffic mocked.');
}catch(error){console.error('Current screen:',page.url(),(await page.locator('body').innerText()).slice(0,3500));throw error;}finally{await browser.close();}
