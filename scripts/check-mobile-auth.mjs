import { writeFile, mkdir } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
await mkdir('audit/mobile-v2', {recursive:true});

async function guestAccess() {
 const {browser,page,writes,errors,go,shot,settled,listingId,conversationId} = await mobileAuthFixture({});
 try {
await go('/');
await page.getByRole('button', {name:'Geç', exact:true}).waitFor({timeout:60000});
const google = page.getByRole('button', {name:'Google ile devam et', exact:true});
if (await google.isDisabled()) throw new Error('Google must remain clickable before consent');
await google.click();
await page.getByText('Devam etmek için önce bu kutuyu işaretle.', {exact:true}).waitFor();
if (new URL(page.url()).hostname !== 'localhost') throw new Error('OAuth started before consent');
await page.getByRole('checkbox', {name:'Yasal metinleri kabul ediyorum', exact:true}).click();
await page.getByText('Devam etmek için önce bu kutuyu işaretle.', {exact:true}).waitFor({state:'hidden'});
if (await google.isDisabled()) throw new Error('Checked consent must enable Google');
await page.getByText('Gizlilik Politikası', {exact:true}).click();
await page.getByRole('button', {name:'Kapat',exact:true}).click();
if (await google.isDisabled()) throw new Error('Reading legal terms must preserve checkbox');
await page.getByRole('checkbox', {name:'Yasal metinleri kabul ediyorum', exact:true}).click();
if (await google.isDisabled()) throw new Error('Unchecking consent must keep the action discoverable');
await google.click();
await page.getByText('Devam etmek için önce bu kutuyu işaretle.', {exact:true}).waitFor();
await shot({path:'audit/mobile-v2/auth-explicit-consent.png', fullPage:true});
await page.getByRole('button', {name:'Geç', exact:true}).click();
await page.getByRole('button', {name:'Kampanya 1', exact:true}).waitFor();
const heroY = (await page.getByText('İlan ver, ortak ol,\nkazanmaya başla!',{exact:true}).boundingBox()).y;
const categoryY = (await page.getByRole('button', {name:'Emlak',exact:true}).boundingBox()).y;
if (heroY >= categoryY) throw new Error('Hero must precede categories');
for (const name of ['Emlak','Vasıta','Elektronik','Ev & Yaşam','Hobi & Spor','İkinci El & Sıfır Alışveriş','İş Makineleri & Sanayi','Ustalar & Hizmetler','Özel Ders & Eğitim','Tüm Kategoriler']) await page.getByRole('button',{name,exact:true}).waitFor();
await shot({path:'audit/mobile-v2/home-cat-10-categories.png'});
await page.getByRole('button', {name:'Kampanya 2',exact:true}).click();
await page.getByText('Ürününü paylaş,\nortaklarını bul!',{exact:true}).waitFor();
// Route-level guest protection, including fresh deep links.
for (const path of ['/create','/messages','/chat/'+conversationId,'/partnership-request/'+listingId,'/partner','/listing-edit/'+listingId]) {
  await go(path);
  await page.getByRole('button',{name:'Geç',exact:true}).waitFor({timeout:15000});
  if (!new URL(page.url()).pathname.startsWith('/auth')) throw new Error('Guest accessed '+path);
}
await page.getByRole('button', {name:'Geç',exact:true}).click();
await page.getByRole('button', {name:'İlan Ver',exact:true}).first().click();
await page.getByRole('button', {name:'Geç',exact:true}).waitFor();
// Refresh is a new launch; skipping does not fake a persisted account.
await page.getByRole('button',{name:'Geç',exact:true}).click();
await page.reload();
await settled();
await page.getByRole('button',{name:'Geç',exact:true}).waitFor();
if (writes.length) throw new Error('Guest created backend writes');
await writeFile('audit/mobile-v2/access-ui-test.json',JSON.stringify({mockOnly:true, startup:true, guestSkip:true, protectedDeepLinks:6, consentRequired:true, restoredOnReload:false, writes, errors},null,2));

if(errors.length) throw new Error(JSON.stringify(errors));
console.log('Guest startup / skip / protected routes / explicit consent passed');

 } finally { await browser.close(); }
}

async function restoredSession() {
 const {browser,page,writes,errors,go,shot,settled,listingId,conversationId} = await mobileAuthFixture({authenticated:true,provider:'google'});
 try {
await go('/auth');
await page.getByRole('button',{name:'Kampanya 1',exact:true}).waitFor({timeout:20000});
if (await page.getByRole('button',{name:'Geç',exact:true}).count()) throw new Error('Restored session must bypass auth');
await page.reload();
await settled();
await page.getByRole('button',{name:'Kampanya 1',exact:true}).waitFor();
await page.waitForTimeout(1000);
if(writes.some(w=>w.table==='legal_consents')) throw new Error('A restored Google session must not fabricate consent');
await page.getByRole('img',{name:'OrtakSat kedi maskotu',exact:true}).waitFor();
await page.waitForFunction(()=>[...document.images].some(i=>i.alt==='OrtakSat kedi maskotu' && i.naturalWidth>0));
await shot({path:'audit/mobile-v2/home-cat-restored-session.png'});
// Explicit OAuth acceptance survives the external browser round trip, then is consumed once.
const acceptedAt=new Date().toISOString();
await page.evaluate(acceptedAt=>localStorage.setItem('ortaksat.oauth-consent.v1', JSON.stringify({provider:'google',version:'2026-06-11',acceptedAt})),acceptedAt);
await page.reload();
await settled();
await page.getByRole('button',{name:'Kampanya 1',exact:true}).waitFor();
await page.waitForTimeout(1000);
const consents=writes.filter(w=>w.table==='legal_consents');
if(consents.length!==4 || consents.some(w=>w.body.accepted_at!==acceptedAt)) throw new Error('Explicit legal acceptance was not persisted correctly: '+JSON.stringify(consents));
await page.reload();
await settled();
await page.getByRole('button',{name:'Kampanya 1',exact:true}).waitFor();
await page.waitForTimeout(600);
if(writes.filter(w=>w.table==='legal_consents').length!==4) throw new Error('Consent must be consumed only once');
await page.setViewportSize({width:320,height:740});
await shot({path:'audit/mobile-v2/home-cat-320.png'});
await page.setViewportSize({width:1180,height:820});
await shot({path:'audit/mobile-v2/home-cat-tablet.png'});
await writeFile('audit/mobile-v2/session-consent-test.json',JSON.stringify({mockOnly:true,persistedSessionRestored:true,noConsentFabricated:true,explicitConsentRecordedOnce:true,legalWrites:consents.length,errors},null,2));

if(errors.length)throw new Error(JSON.stringify(errors));
console.log('Persisted Google session / reload / explicit consent recording passed');

 } finally { await browser.close(); }
}

async function signupVerification() {
 const {browser,page,writes,errors,go,shot,settled,listingId,conversationId} = await mobileAuthFixture({verification:true});
 try {
await go('/auth');
await page.getByRole('tab',{name:'Hesap Oluştur',exact:true}).click();
await page.getByRole('button',{name:'E-posta ile devam et',exact:true}).click();
await page.getByPlaceholder('Ayşe',{exact:true}).fill('Örnek');
await page.getByPlaceholder('Demir',{exact:true}).fill('Kullanıcı');
await page.getByPlaceholder('ornek@eposta.com',{exact:true}).fill('preview@example.invalid');
await page.getByPlaceholder('Güçlü bir şifre oluştur',{exact:true}).fill('LocalTest!2026');
await page.getByPlaceholder('Şifreni tekrar gir',{exact:true}).fill('LocalTest!2026');
await page.getByRole('button',{name:'Kayıt ol',exact:true}).click();
await page.waitForTimeout(300);
if(writes.some(w=>w.table==='signup')) throw new Error('Registration bypassed consent');
// Close the validation alert if present before accepting.
const ok=page.getByRole('button',{name:/^(Tamam|OK)$/});
if(await ok.count()) await ok.first().click();
await page.getByRole('checkbox',{name:'Yasal metinleri kabul ediyorum',exact:true}).click();
await page.getByRole('button',{name:'Kayıt ol',exact:true}).click();
await page.getByText('E-postanı doğrula',{exact:true}).waitFor({timeout:20000});
if(!writes.some(w=>w.table==='signup'))throw new Error('Registration did not reach mock signup');
if(await page.getByRole('button',{name:'Kampanya 1',exact:true}).count()) throw new Error('Unverified signup must not enter app');
await shot({path:'audit/mobile-v2/signup-verification.png'});
await page.getByPlaceholder('______',{exact:true}).fill('123456');
await page.getByRole('button',{name:'Doğrula ve giriş yap',exact:true}).click();
await page.getByRole('button',{name:'Kampanya 1',exact:true}).waitFor();
await page.reload();
await settled();
await page.getByRole('button',{name:'Kampanya 1',exact:true}).waitFor();
await writeFile('audit/mobile-v2/signup-ui-test.json',JSON.stringify({mockOnly:true,consentRequired:true,verificationBeforeEntry:true,autoLoginAfterVerification:true,sessionRestoredAfterReload:true,errors},null,2));

if(errors.length)throw new Error(JSON.stringify(errors));
console.log('Registration / consent / email verification / auto-login / reload passed');

 } finally { await browser.close(); }
}

async function profileReadFailure() {
  const { browser, page, writes, errors, go } = await mobileAuthFixture({authenticated:true,profileUnavailable:true});
  try {
    await go('/');
    await page.getByRole('button',{name:'Kampanya 1',exact:true}).waitFor();
    if (await page.getByRole('button',{name:'Geç',exact:true}).count()) throw new Error('Profile read failure discarded a valid session');
    if (writes.some(w=>w.table==='ensure_my_profile')) throw new Error('Restore overwrote profile with fallback values');
    if(errors.length)throw new Error(JSON.stringify(errors));
    await writeFile('audit/mobile-v2/profile-fallback-test.json',JSON.stringify({mockOnly:true,sessionKept:true,noFallbackProfileOverwrite:true,errors},null,2));
    console.log('Temporary profile failure preserves session without overwriting data');
  } finally { await browser.close(); }
}

async function googleAction() {
  const { browser, page, errors, go, shot } = await mobileAuthFixture();
  const oauthRequests = [];
  page.on('request', request => { if (request.url().includes('/auth/v1/authorize')) oauthRequests.push(request.url()); });
  try {
    await go('/auth');
    const google = page.getByRole('button', {name:'Google ile devam et',exact:true});
    const checkbox = page.getByRole('checkbox', {name:'Yasal metinleri kabul ediyorum',exact:true});
    const hint = page.getByText('Devam etmek için önce bu kutuyu işaretle.', {exact:true});
    if (await google.isDisabled()) throw new Error('Google looks unavailable');
    await google.click();
    await hint.waitFor();
    if (oauthRequests.length) throw new Error('OAuth started without consent');
    if (await page.getByRole('alert').count()) throw new Error('Missing consent must show guidance at the checkbox, not a red login error');
    await shot({path:'audit/mobile-v2/google-consent-guidance.png',fullPage:true});
    await checkbox.click();
    await hint.waitFor({state:'hidden'});
    await checkbox.click();
    await page.getByRole('button',{name:'E-posta ile devam et',exact:true}).click();
    // Provider choices stay on the shared landing; returning preserves the consent state.
    await page.getByRole('button',{name:'Diğer giriş seçenekleri',exact:true}).click();
    await google.click();
    await hint.waitFor();
    if (oauthRequests.length) throw new Error('Email form bypassed consent');
    await checkbox.click();
    await hint.waitFor({state:'hidden'});
    const [request] = await Promise.all([
      page.waitForRequest(request => request.url().includes('/auth/v1/authorize')),
      google.click(),
    ]);
    if (new URL(request.url()).searchParams.get('provider') !== 'google') throw new Error('Incorrect OAuth provider');
    if(errors.length) throw new Error(JSON.stringify(errors));
    await writeFile('audit/mobile-v2/google-action-test.json',JSON.stringify({mockOnly:true,buttonAlwaysEnabled:true,consentHintOnClick:true,noOAuthBeforeConsent:true,oauthStartsAfterConsent:true,emailFormBackPreservesConsent:true,errors},null,2));
    console.log('Google action stays enabled, explains consent and starts mocked OAuth only after acceptance');
  } finally { await browser.close(); }
}

const cases = { guest: guestAccess, session: restoredSession, signup: signupVerification, profile: profileReadFailure, google: googleAction };
if (process.argv[2]) {
  const run = cases[process.argv[2]];
  if (!run) throw new Error('Choose guest, session, signup, profile or google');
  await run();
} else {
  for (const run of Object.values(cases)) await run();
}
