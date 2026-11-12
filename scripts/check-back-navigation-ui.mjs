import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';

const { page, browser, go, api, listing, errors } = await mobileAuthFixture({ authenticated: true });
// Use a fresh Metro client bundle over the already rendered local test shell.
// This avoids repeatedly rendering every static category route during UI checks.
if (process.env.NAVIGATION_METRO_URL) {
  const url = new URL(process.env.NAVIGATION_METRO_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Local Metro only');
  const response = await fetch(`${url.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);
  if (!response.ok) throw Error(`Metro bundle failed: ${response.status}`);
  const bundle = await response.text();
  await page.route('**/assets/**', async route => {
    const asset = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: url.origin + asset.pathname + asset.search }) });
  });
  await page.route('**/_expo/static/js/web/entry-*.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }));
}
const findings = [];
page.on('pageerror', error => console.error('PAGE ERROR', error.stack));
async function heading(text) { await page.getByRole('heading', { name: text, exact: true }).waitFor(); }
async function back() { await page.getByRole('button', { name: 'Geri', exact: true }).last().click(); }
try {
  await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`, route => route.fulfill({ json: { listings: [listing], total: 1 } }));
  await go('/kategoriler');
  await page.getByRole('button', { name: 'Emlak', exact: true }).click();
  await heading('Emlak');
  await page.getByRole('button', { name: 'Sahibinden', exact: true }).click();
  await page.getByRole('button', { name: 'Konut', exact: true }).click();
  await heading('Konut');
  assert.match(page.url(), /\/kategori\/konut/);
  await page.getByRole('button', { name: 'Satılık', exact: true }).click();
  await heading('Satılık');
  await back(); await heading('Konut');
  await back(); await heading('Emlak');
  await page.waitForFunction(() => JSON.parse(new URL(location.href).searchParams.get('saved') || '{}').mobile?.owner === true);
  assert.equal(JSON.parse(new URL(page.url()).searchParams.get('saved')).mobile.owner, true);
  await back(); await heading('Kategoriler');
  findings.push('Category stack returns Satılık → Konut → Emlak → Kategoriler; parent filter retained');

  await go('/kategori/emlak');
  await page.getByRole('button', { name: 'Filtrele', exact: true }).click();
  await heading('Filtrele');
  await back(); await heading('Emlak');
  await page.getByRole('button', { name: 'Favoriler', exact: true }).click();
  await heading('Favorilerim');
  await back(); await heading('Emlak');
  findings.push('Filter Back closes the filter; favorites Back returns to its source category');

  await go('/partner');
  await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'Keşfet', exact: true }).click();
  await page.waitForURL(/\/explore/);
  await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'Ortak Satış', exact: true }).click();
  await heading('Ortak Satış');
  await page.goBack(); await page.waitForURL(/\/explore/);
  await page.goBack(); await heading('Ortak Satış');
  findings.push('Repeated tab visits preserve order for browser Back');

  // A fresh document has no app navigation history, so contextual fallback is used.
  await go('/kategori/konut'); await heading('Konut');
  await back(); await heading('Emlak');
  await go('/account-security'); await heading('Hesap Güvenliği');
  await back(); await heading('Hesap Ayarları');
  findings.push('Direct category/security links return to their relevant parent section');

  await go('/create'); await heading('İlan Ver');
  await page.getByRole('button', { name: '3. Ortaklık Ayarları', exact: true }).click();
  await back();
  assert.equal(await page.getByRole('button', { name: '2. Ürün Bilgileri', exact: true }).getAttribute('aria-pressed'), 'true');
  await back();
  assert.equal(await page.getByRole('button', { name: '1. Fotoğraf', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.match(page.url(), /\/create/);
  findings.push('Create Back returns to the previous step while keeping the form open');

  assert.deepEqual(errors, []);
  await writeFile('audit/mobile-v4/back-navigation-ui.json', JSON.stringify({ mockOnly: true, findings, errors }, null, 2));
  console.log('Passed:', findings.join('; '));
} catch (error) {
  console.error(page.url(), (await page.locator('body').innerText()).slice(-2000));
  await page.screenshot({ path: 'audit/mobile-v4/back-navigation-failure.png' });
  throw error;
} finally { await browser.close(); }
