import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';

const engine = process.env.TEST_BROWSER || 'chromium';
const f = await mobileAuthFixture({ browserName: engine });
const { page, go, browser, errors } = f;
const results = [];
await mkdir('audit/mobile-web-design', { recursive: true });
async function fits() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
}
try {
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go('/auth');
    const email = page.getByRole('textbox', { name: 'E-posta', exact: true });
    await email.waitFor();
    assert.equal(await email.getAttribute('autocomplete'), 'email');
    assert.ok((await email.boundingBox()).y < 650, 'Email visible without opening another screen');
    await email.fill('preview@example.invalid');
    await page.getByPlaceholder('Şifreni gir', { exact: true }).fill('LocalTest!2026');
    await page.getByRole('button', { name: 'Şifreyi göster', exact: true }).click();
    assert.equal(await page.getByPlaceholder('Şifreni gir', { exact: true }).getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Şifremi unuttum', exact: true }).click();
    await page.getByRole('button', { name: 'Sıfırlama kodu gönder', exact: true }).waitFor();
    assert.equal(await email.inputValue(), 'preview@example.invalid');
    await page.getByRole('button', { name: 'Girişe dön', exact: true }).click();
    await page.getByRole('tab', { name: 'Hesap Oluştur', exact: true }).click();
    await page.getByPlaceholder('Ayşe', { exact: true }).fill('Örnek');
    await page.getByPlaceholder('Demir', { exact: true }).fill('Kullanıcı');
    await page.getByRole('button', { name: 'Kayıt ol', exact: true }).waitFor();
    await fits();
    await f.shot({ path: `audit/mobile-web-design/${engine}-register-${width}.png`, fullPage: true });
    results.push({ width, directEmail: true, resetAndBack: true, register: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await go('/auth?mode=reset');
  await page.getByRole('button', { name: 'Sıfırlama kodu gönder', exact: true }).waitFor();
  await go('/');
  await page.getByTestId('mobile-web-partner-steps').waitFor();
  const steps = page.getByRole('button', { name: 'Satış ortağı olarak nasıl kazanırsın?', exact: true });
  await steps.click();
  await page.getByText('Satıcıyla komisyon koşullarında anlaş.', { exact: true }).waitFor();
  await steps.click();
  await f.shot({ path: `audit/mobile-web-design/${engine}-home.png`, fullPage: false });
  const nav = page.getByTestId('mobile-web-primary-nav');
  await nav.getByRole('link', { name: 'Menü', exact: true }).click();
  await page.getByTestId('web-account-menu').waitFor();
  assert.equal(await page.getByText('HESABIM', { exact: true }).count(), 0, 'Guest menu avoids inaccessible account links');
  await page.getByRole('button', { name: 'Yardım ve bilgi', exact: true }).click();
  await page.getByRole('link', { name: 'Yardım merkezi', exact: true }).waitFor();
  await fits();
  await f.shot({ path: `audit/mobile-web-design/${engine}-menu.png`, fullPage: true });
  await go('/');
  await page.getByRole('button', { name: 'Menü', exact: true }).click();
  await page.getByTestId('web-account-menu').waitFor();
  await page.getByRole('link', { name: 'Giriş yap', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/auth');
  await page.getByRole('textbox', { name: 'E-posta', exact: true }).waitFor();
  await fits();
  assert.deepEqual(errors, []);
  assert.equal(f.writes.length, 0, 'No backend mutation');
  await writeFile(`audit/mobile-web-design/${engine}-checks.json`, JSON.stringify({ engine, results, primaryNavigation: true, menu: true, drawerNavigation: true, errors, backendWrites: 0 }, null, 2));
  console.log(`${engine}: direct login/register/reset at five widths, home purpose, menu expansion and drawer navigation passed; no backend writes.`);
} finally { await browser.close(); }

const signedIn = await mobileAuthFixture({ authenticated: true, browserName: engine });
try {
  await signedIn.go('/menu');
  await signedIn.page.getByText('HESABIM', { exact: true }).waitFor();
  await signedIn.page.getByRole('button', { name: 'Diğer hesap işlemleri', exact: true }).click();
  await signedIn.page.getByRole('link', { name: 'Hesap güvenliği', exact: true }).waitFor();
  await signedIn.shot({ path: `audit/mobile-web-design/${engine}-account-menu.png`, fullPage: true });
  assert.deepEqual(signedIn.errors, []);
  assert.equal(signedIn.writes.length, 0);
  console.log(`${engine}: authenticated menu and additional account destinations passed.`);
} finally { await signedIn.browser.close(); }
