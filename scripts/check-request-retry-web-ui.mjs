import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, go, api, listing, errors } = await mobileAuthFixture({ authenticated: true });
const origin = process.env.MOBILE_TEST_URL;
const html = await readFile('dist-check-mobile/listing-actions-web-final/partnership-request/[id].html', 'utf8');
let calls = 0, recovering = false;
try {
  // Serve the exported dynamic-route template at its real public path.
  await page.route(`${origin}/partnership-request/${listing.id}`, route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.route(`${api}/rest/v1/listing_public_cards**`, route => {
    const req = route.request(), id = new URL(req.url()).searchParams.get('id');
    if (id !== `eq.${listing.id}`) return route.fulfill({ json: [] });
    calls++;
    if (!recovering) return route.fulfill({ status: 503, json: { message: 'Local request load outage' } });
    return route.fulfill({ json: req.headers().accept?.includes('vnd.pgrst.object') ? listing : [listing] });
  });
  await go(`/partnership-request/${listing.id}`);
  await page.getByRole('button', { name: 'İlanı yeniden yükle', exact: true }).waitFor();
  assert.equal(await page.getByText('İlan bulunamadı', { exact: true }).count(), 0);
  const failedCalls = calls; recovering = true;
  await page.getByRole('button', { name: 'İlanı yeniden yükle', exact: true }).click();
  await page.getByRole('textbox', { name: 'Teklif Ettiğin Komisyon Tutarı', exact: true }).waitFor();
  assert.ok(calls > failedCalls); assert.deepEqual(errors, []);
  await writeFile('audit/web-review/request-retry-ui.json', JSON.stringify({ mockOnly: true, calls, retryRestoresForm: true, noFalseMissingListing: true, errors }, null, 2));
  console.log('Passed direct request-link load failure and retry on the exported web page.');
} catch (error) {
  await writeFile('audit/web-review/request-retry-debug.json', JSON.stringify({ calls, errors, url: page.url(), text: await page.locator('body').innerText() }, null, 2));
  throw error;
} finally { await browser.close(); }
