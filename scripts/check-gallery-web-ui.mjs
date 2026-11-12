import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, go, api, listing, me, errors } = await mobileAuthFixture({ authenticated: true });
const empty = { ...listing, image_url: null, ad_assets: [], title: 'Fotoğrafsız web test ilanı' };
const actual = { ...listing, id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002', title: 'Gerçek fotoğraflı test ilanı', ad_assets: [listing.image_url, listing.image_url + '?second'] };
const rows = [empty, actual];
try {
  await page.route(`${api}/rest/v1/favorites**`, route => route.fulfill({ json: rows.map((r,i) => ({ id: `photo-favorite-${i}`, listing_id: r.id, user_id: me, created_at: new Date().toISOString() })) }));
  await page.route(`${api}/rest/v1/listing_public_cards**`, route => {
    const request = route.request(), id = new URL(request.url()).searchParams.get('id')?.replace('eq.','');
    const found = id ? rows.filter(r => r.id === id) : rows;
    return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? found[0] || null : found });
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go('/favorites?view=collections');
    await page.getByText(empty.title, { exact: true }).first().click();
    await page.getByText('Bu ilanda fotoğraf yok', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('listing-web-gallery').getAttribute('aria-disabled'), 'true');
    assert.equal(await page.getByTestId('listing-web-counter').count(), 0);
    await page.getByRole('button', { name: 'Geri', exact: true }).first().click();
    await page.getByText(actual.title, { exact: true }).first().click();
    await page.getByTestId('listing-web-counter').waitFor();
    assert.ok((await page.getByTestId('listing-web-counter').innerText()).includes('1/2'), 'Duplicate cover must not add another gallery photo');
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
  }
  assert.deepEqual(errors, []);
  await writeFile('audit/web-review/gallery-ui.json', JSON.stringify({ widths: [390,1440], noFabricatedPhoto: true, emptyGalleryCannotEnlarge: true, deduplicatedCover: true, errors }, null, 2));
  console.log('Passed web photo-free and real-photo gallery at 390/1440px, with no duplicated cover or empty lightbox action.');
} finally { await browser.close(); }
