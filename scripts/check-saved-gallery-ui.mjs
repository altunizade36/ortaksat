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
const blank = { ...listing, id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002', title: 'Fotoğrafsız test ilanı', image_url: null, ad_assets: [], currency: 'EUR' };
const photos = { ...listing, title: 'Galeri test ilanı', image_url: listing.image_url, ad_assets: [listing.image_url, listing.image_url + '?second', listing.image_url + '?third'], currency: 'EUR' };
const rows = [photos, blank], requests = [];
try {
 await page.route(`${api}/rest/v1/listing_public_cards**`, route => {
   const req = route.request(), url = new URL(req.url()), id = url.searchParams.get('id')?.replace('eq.','');
   const found = id ? rows.filter(r => r.id === id) : rows;
   return route.fulfill({ json: req.headers().accept?.includes('vnd.pgrst.object') ? found[0] || null : found });
 });
 await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`, route => { const p = route.request().postDataJSON().params; requests.push(p); return route.fulfill({ json: { listings: rows, total: 2 } }); });
 await page.route(`${api}/rest/v1/saved_searches**`, route => route.fulfill({ json: [{ id: 'cccccccc-cccc-4ccc-8ccc-000000000001', q: 'Galeri', created_at: '2026-10-26T00:00:00Z', filters: { mobile: { currency: 'EUR', min: '0', max: '5000000', loc: { provinceId: 34 } }, cat: 'emlak', sort: 'new' } }] }));
 await go('/kategoriler');
 await page.getByRole('button', { name: 'Emlak', exact: true }).click();
 await page.getByRole('button', { name: photos.title, exact: true }).click();
 const counter = page.locator('[data-testid="listing-gallery-counter"]:visible');
 await counter.getByText('1/3', { exact: true }).waitFor();
 await page.getByRole('button', { name: 'Fotoğraf 2', exact: true }).click();
 await counter.getByText('2/3', { exact: true }).waitFor();
 const photoBounds = await page.getByRole('button', { name: 'Fotoğrafı büyüt 2', exact: true }).boundingBox();
 assert.ok(photoBounds.height > 200 && photoBounds.width >= 300, 'Hero photo must have real dimensions');
 await page.getByRole('button', { name: 'Fotoğrafı büyüt 2', exact: true }).click();
 await page.getByTestId('listing-lightbox').waitFor();
 await page.getByRole('button', { name: 'Galeriyi kapat', exact: true }).click();
 await page.getByTestId('listing-lightbox').waitFor({ state: 'hidden' });
 await page.setViewportSize({ width: 740, height: 900 });
 await counter.getByText('2/3', { exact: true }).waitFor();
 assert.equal(await page.getByRole('button', { name: 'Fotoğraf 2', exact: true }).getAttribute('aria-pressed'), 'true');
 await page.setViewportSize({ width: 390, height: 844 });
 await page.getByRole('button', { name: 'Geri', exact: true }).click();
 await page.getByRole('button', { name: blank.title, exact: true }).click();
 await page.getByText('Bu ilanda fotoğraf yok', { exact: true }).waitFor();
 assert.equal(await page.locator('[data-testid="listing-gallery-counter"]:visible').count(), 0);
 assert.equal(await page.getByRole('button', { name: /^Fotoğrafı büyüt/ }).count(), 0);
 await page.screenshot({ path: 'audit/mobile-v4/listing-no-photo.png' });
 await page.getByRole('button', { name: 'Geri', exact: true }).click();
 await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'Menü', exact: true }).click();
 await page.getByRole('button', { name: 'Kaydedilen Aramalar', exact: true }).click();
 await page.getByRole('button', { name: 'Aramayı Aç', exact: true }).click();
 await page.waitForFunction(() => location.pathname === '/explore');
 await page.getByRole('button', { name: 'Aramayı Kaydet', exact: true }).waitFor();
 assert.ok(requests.some(p => p.q === 'Galeri' && p.filters.currency === 'EUR' && p.filters.loc.provinceId === 34 && p.sort === 'newest' && p.filters.min === '0'));
 await page.getByRole('button', { name: 'Para birimi: EUR ×', exact: true }).waitFor();
 await page.getByRole('button', { name: '0 – 5000000 EUR ×', exact: true }).waitFor();
 await page.getByRole('button', { name: 'Konut', exact: true }).click();
 await page.waitForFunction(() => location.pathname.startsWith('/kategori/'));
 await page.getByRole('button', { name: '0 – 5000000 EUR ×', exact: true }).waitFor();
 const retained = JSON.parse(new URL(page.url()).searchParams.get('saved'));
 assert.equal(retained.mobile.currency, 'EUR'); assert.equal(retained.mobile.loc.provinceId, 34); assert.equal(retained.mobile.min, '0'); assert.equal(retained.sort, 'newest');

 await page.getByRole('button', { name: /^Filtrele/ }).click();
 await page.getByRole('button', { name: 'Para Birimi: EUR', exact: true }).waitFor();
 assert.equal(await page.getByRole('textbox', { name: 'Min. Fiyat', exact: true }).getAttribute('placeholder'), '€ 0');
 await page.getByRole('button', { name: 'Filtreleri sıfırla', exact: true }).click();
 await page.getByRole('button', { name: '2 ilan göster', exact: true }).waitFor();
 await page.getByRole('button', { name: '2 ilan göster', exact: true }).click();
 await page.waitForFunction(() => !JSON.parse(new URL(location.href).searchParams.get('saved')).mobile.currency);
 assert.deepEqual(errors, []);
 await writeFile('audit/mobile-v4/saved-gallery-ui.json', JSON.stringify({ mockOnly: true, photoCount: 3, selectedPhotoSurvivesResize: true, lightbox: true, noFabricatedPhoto: true, savedCurrencyAndSortRestored: true, errors }, null, 2));
 console.log('Passed gallery selection/lightbox/resize, photo-free listing and saved-search currency/sort restoration.');
} catch (error) { console.error(page.url(), (await page.locator('body').innerText()).slice(-2000)); await page.screenshot({ path: 'audit/mobile-v4/saved-gallery-failure.png' }); throw error; }
finally { await browser.close(); }
