import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, go, api, listing, errors } = await mobileAuthFixture({ authenticated: true });
const metro = new URL(process.env.NAVIGATION_METRO_URL);
if (!['localhost', '127.0.0.1'].includes(metro.hostname)) throw Error('Local Metro only');
const response = await fetch(`${metro.origin}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app`);
assert.ok(response.ok); const bundle = await response.text();
await page.route('**/_expo/static/js/web/entry-*.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }));
await page.route('**/assets/**', async route => { const u = new URL(route.request().url()); await route.fulfill({ response: await route.fetch({ url: metro.origin + u.pathname + u.search }) }); });
const rows = Array.from({ length: 26 }, (_, i) => ({ ...listing, id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i + 1).padStart(12, '0')}`, title: `Sayfalama örnek ilan ${i + 1}` }));
const requests = []; let failMore = true, release, delayOld = false;
try {
  await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`, async route => {
    const p = route.request().postDataJSON().params; requests.push(p);
    if (p.limit === 1) return route.fulfill({ json: { listings: [rows[0]], total: 1 } });
    if (p.q) return route.fulfill({ json: { listings: [rows[25]], total: 1 } });
    if (!p.offset) return route.fulfill({ json: { listings: rows.slice(0, 24), total: 28 } });
    if (failMore) {
      await new Promise(resolve => { release = resolve; });
      return route.fulfill({ status: 503, json: { message: 'Local next page outage' } });
    }
    if (p.offset === 24) return route.fulfill({ json: { listings: [rows[23], rows[24]], total: 28 } });
    if (delayOld) { await new Promise(resolve => { release = resolve; }); return route.fulfill({ json: { listings: [rows[24]], total: 28 } }); }
    return route.fulfill({ json: { listings: [], total: 28 } });
  });
  await go('/kategoriler'); await page.getByRole('button', { name: 'Emlak', exact: true }).click();
  await page.getByRole('button', { name: rows[23].title, exact: true }).waitFor();
  const more = page.getByRole('button', { name: /^(Daha fazla ilan göster|Tekrar dene)$/ });
  await more.click(); await page.getByRole('button', { name: 'Yükleniyor…', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Yükleniyor…', exact: true }).isDisabled(), true);
  assert.equal(requests.filter(p => p.offset === 24).length, 1);
  release(); await page.getByText('Diğer ilanlar yüklenemedi. Yeniden deneyebilirsin.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: rows[0].title, exact: true }).count(), 1);
  failMore = false; await more.click(); await page.getByRole('button', { name: rows[24].title, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: rows[23].title, exact: true }).count(), 1);
  await more.click(); await page.getByRole('button', { name: 'Yükleniyor…', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(requests.at(-1).offset, 26, 'Offset follows consumed server rows, including overlaps');
  assert.equal(await page.getByRole('button', { name: rows[24].title, exact: true }).count(), 1);
  const input = page.locator('input[aria-label="İlanlarda ara"]:visible');
  await input.fill('yenikriter'); await page.getByRole('button', { name: 'İlan ara', exact: true }).click();
  await page.getByRole('button', { name: rows[25].title, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Aramayı temizle', exact: true }).click();
  await more.waitFor(); await more.click(); await page.getByRole('button', { name: rows[24].title, exact: true }).waitFor();
  delayOld = true; await more.click(); await page.getByRole('button', { name: 'Yükleniyor…', exact: true }).waitFor();
  await input.fill('yeniarama'); await page.getByRole('button', { name: 'İlan ara', exact: true }).click();
  await page.getByRole('button', { name: rows[25].title, exact: true }).waitFor();
  const oldResponse = page.waitForResponse(r => r.url().includes('mobile_catalogue_page') && r.request().postDataJSON().params.offset === 26); release(); await oldResponse;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.getByRole('button', { name: rows[24].title, exact: true }).waitFor({ state: 'hidden' });
  assert.equal(await more.count(), 0);
  assert.deepEqual(errors, []);
  await writeFile('audit/mobile-v4/catalogue-pagination-ui.json', JSON.stringify({ mockOnly: true, overlapDeduplicated: true, rawOffset: 26, failedPagePreservesRows: true, emptyPageStopsPagination: true, stalePageIgnored: true, errors }, null, 2));
  console.log('Passed catalogue overlap, retry, single-flight loading, empty page termination and criteria switch during pagination.');
} catch (error) { console.error((await page.locator('body').innerText()).slice(-1600)); throw error; }
finally { await browser.close(); }
