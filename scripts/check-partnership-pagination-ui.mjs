import assert from 'node:assert/strict';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { page, browser, go, api, listing, errors } = await mobileAuthFixture({ authenticated: true });
let fail = true;
const calls = [];
try {
  await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`, async route => {
    const params = route.request().postDataJSON().params;
    calls.push(params);
    if (params.offset && fail) return route.fulfill({ status: 503, json: { message: 'Local page failure' } });
    const start = params.offset || 0;
    await route.fulfill({ json: { listings: Array.from({ length: start ? 1 : 24 }, (_, i) => ({ ...listing, id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(start+i).padStart(12, '0')}`, title: `Yerel Ortaklık Fırsatı ${start+i+1}` })), total: 25 } });
  });
  await go('/partner');
  await page.getByRole('button', { name: 'Ortaklık ilanı: Yerel Ortaklık Fırsatı 24', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Diğer İlanları Göster', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Açık olan ilanların korunuyor' }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Ortaklık ilanı: Yerel Ortaklık Fırsatı/ }).count(), 24);
  assert.equal(calls.at(-1).offset, 24);
  fail = false;
  await page.getByRole('button', { name: 'Diğer İlanları Yeniden Yükle', exact: true }).click();
  await page.getByRole('button', { name: 'Ortaklık ilanı: Yerel Ortaklık Fırsatı 25', exact: true }).waitFor();
  assert.equal(calls.at(-1).offset, 24);
  assert.equal(await page.getByRole('button', { name: /^Ortaklık ilanı: Yerel Ortaklık Fırsatı/ }).count(), 25);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('Passed partnership pagination: 24 cards retained after failure, same-offset retry and 25 unique cards after recovery. All data mocked.');
} finally { await browser.close(); }
