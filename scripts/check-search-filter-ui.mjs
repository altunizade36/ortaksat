import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, go, api, listing, errors } = await mobileAuthFixture({ authenticated: true });
const metro = process.env.NAVIGATION_METRO_URL;
if (metro) {
  const url = new URL(metro);
  if (!['localhost','127.0.0.1'].includes(url.hostname)) throw Error('Local Metro only');
  const response = await fetch(`${url.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);
  assert.ok(response.ok);
  const bundle = await response.text();
  await page.route('**/_expo/static/js/web/entry-*.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }));
  await page.route('**/assets/**', async route => { const u = new URL(route.request().url()); await route.fulfill({ response: await route.fetch({ url: url.origin + u.pathname + u.search }) }); });
}
const requests = [];
let countFailure = false;
const findings = [];
try {
  await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`, async route => {
    const p = route.request().postDataJSON().params; requests.push(p);
    if (countFailure && p.limit === 1) return route.fulfill({ status: 503, json: { message: 'Local count outage' } });
    const rows = p.q === 'bulunmayan' ? [] : [{ ...listing, partnership_mode: 'invite' }];
    await route.fulfill({ json: { listings: rows, total: rows.length } });
  });
  await go('/kategoriler');
  await page.getByRole('button', { name: 'Emlak', exact: true }).click();
  await page.getByRole('button', { name: 'Filtrele', exact: true }).click();
  await page.getByRole('textbox', { name: 'Min. Fiyat', exact: true }).fill('200');
  await page.getByRole('textbox', { name: 'Maks. Fiyat', exact: true }).fill('900');
  await page.getByRole('switch', { name: 'Sadece ortaklığa açık ilanlar', exact: true }).check();
  await page.getByRole('switch', { name: 'Sadece fotoğraflı ilanlar', exact: true }).check();
  await page.getByRole('button', { name: /^İl:/ }).click();
  await page.getByRole('button', { name: 'İstanbul', exact: true }).click();
  await page.getByRole('button', { name: '1 ilan göster', exact: true }).waitFor();
  await page.getByRole('button', { name: '1 ilan göster', exact: true }).click();
  await page.getByRole('heading', { name: 'Filtrele', exact: true }).waitFor({ state: 'hidden' });
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
  const input = page.locator('input[aria-label="İlanlarda ara"]:visible');
  await input.fill('  iphone   13  '); await page.getByRole('button', { name: 'İlan ara', exact: true }).click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'iphone 13');
  assert.ok(requests.some(p => p.q === 'iphone 13' && p.root === 'Emlak' && p.filters.min === '200' && p.filters.loc.provinceId === 34));
  findings.push('Search can be edited in results; normalized text keeps category, price and location');
  await page.getByRole('button', { name: /^Filtrele/ }).click();
  await page.getByRole('textbox', { name: 'Min. Fiyat', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Kategori Değiştir', exact: true }).click();
  await page.getByRole('button', { name: 'Önceki kategori', exact: true }).click();
  await page.getByRole('button', { name: 'Vasıta', exact: true }).click();
  await page.getByRole('button', { name: 'Bu kategoriyi seç', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Min. Fiyat', exact: true }).inputValue(), '200');
  await page.getByRole('button', { name: '1 ilan göster', exact: true }).waitFor();
  assert.ok(requests.some(p => p.root === 'Vasıta' && p.limit === 1 && p.filters.min === '200' && p.filters.loc.provinceId === 34 && Object.keys(p.filters.attrs).length === 0));
  await page.getByRole('button', { name: '1 ilan göster', exact: true }).click();
  await page.getByRole('heading', { name: 'Filtrele', exact: true }).waitFor({ state: 'hidden' });
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
  await page.waitForURL(/\/kategori\/vasita/);
  findings.push('Changing draft category preserves shared criteria and clears incompatible category attributes');

  await page.getByRole('button', { name: /^Filtrele/ }).click();
  await page.getByRole('button', { name: 'Filtreleri sıfırla', exact: true }).click();
  await page.getByRole('button', { name: '1 ilan göster', exact: true }).waitFor();
  await page.getByRole('button', { name: '1 ilan göster', exact: true }).click();
  await page.getByRole('heading', { name: 'Filtrele', exact: true }).waitFor({ state: 'hidden' });
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
  await page.waitForFunction(() => JSON.parse(new URL(location.href).searchParams.get('saved')).mobile.open === false);
  assert.equal(JSON.parse(new URL(page.url()).searchParams.get('saved')).mobile.min, '');
  findings.push('Reset clears an initially applied open-only filter and all user criteria');

  await page.getByRole('button', { name: 'Sahibinden', exact: true }).click();
  await page.getByRole('button', { name: 'Tümü', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(new URL(location.href).searchParams.get('saved')).mobile.owner === false);
  countFailure = true;
  await page.getByRole('button', { name: /^Filtrele/ }).click();
  await page.getByText('Sonuç sayısı alınamadı', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Filtreleri uygula', exact: true }).click();
  await page.getByRole('heading', { name: 'Filtrele', exact: true }).waitFor({ state: 'hidden' });
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
  await page.locator('[data-testid="catalogue-listing"]:visible').last().waitFor();
  countFailure = false;
  findings.push('All tab clears hidden criteria; count preview outage still allows applying filters');

  await input.fill('bulunmayan'); await input.press('Enter');
  await page.getByText('Bu kriterlerde ilan bulunamadı', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Aramayı temizle', exact: true }).last().click();
  await page.locator('[data-testid="catalogue-listing"]:visible').last().waitFor();
  await page.getByText('Davetle Ortaklık', { exact: true }).filter({ visible: true }).waitFor();
  for (const width of [320,390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    await page.screenshot({ path: `audit/mobile-v4/search-filter-${width}.png` });
  }
  findings.push('Empty search has a working clear action; invite-only product is labeled accurately; 320/390px fit');
  assert.deepEqual(errors, []);
  await writeFile('audit/mobile-v4/search-filter-ui.json', JSON.stringify({ mockOnly: true, findings, errors }, null, 2));
  console.log('Passed:', findings.join('; '));
} catch (error) {
  console.error(page.url(), (await page.locator('body').innerText()).slice(-2200));
  await page.screenshot({ path: 'audit/mobile-v4/search-filter-failure.png' });
  throw error;
} finally { await browser.close(); }
