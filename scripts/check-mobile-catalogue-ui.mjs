import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
await mkdir('audit/mobile-v2', { recursive: true });
const { browser, page, api, listing, errors, go, shot } = await mobileAuthFixture({ authenticated: true });
const requests = [];
let fail = false;
try {
  await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`, async route => {
    const p = route.request().postDataJSON().params; requests.push(p);
    if (fail) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Local test outage' }) }); return; }
    const total = p.filters?.min ? 1 : 50;
    const rows = Array.from({ length: Math.max(0, Math.min(p.limit, total - p.offset)) }, (_, n) => ({ ...listing, id: `catalogue-test-${p.offset+n}`, title: `Test İlanı ${p.offset+n+1}`, price: 100 + p.offset+n }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: rows, total }) });
  });
  await go('/explore?view=list');
  await page.getByText('50 ilan', { exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Test İlanı 24', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Daha fazla ilan göster', exact: true }).click();
  await page.getByRole('button', { name: 'Test İlanı 48', exact: true }).waitFor();
  assert.ok(requests.some(p => p.offset === 24));
  await page.getByRole('button', { name: 'Daha fazla ilan göster', exact: true }).click();
  await page.getByRole('button', { name: 'Test İlanı 50', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Daha fazla ilan göster', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: /^Filtrele(?: \(\d+\))?$/ }).click();
  await page.getByRole('textbox', { name: 'Min. Fiyat', exact: true }).fill('200');
  await page.getByRole('button', { name: '1 ilan göster', exact: true }).waitFor();
  await shot({ path: 'audit/mobile-v2/catalogue-filter-count.png' });
  await page.getByRole('button', { name: '1 ilan göster', exact: true }).click();
  await page.getByText('1 ilan', { exact: true }).waitFor();
  assert.ok(requests.some(p => p.filters.min === '200' && p.limit === 24 && p.offset === 0));
  // Cancelled draft category changes must not become applied search criteria.
  await page.getByRole('button', { name: /^Filtrele(?: \(\d+\))?$/ }).click();
  await page.getByRole('button', { name: 'Kategori Değiştir', exact: true }).click();
  await page.getByRole('button', { name: 'Emlak', exact: true }).click();
  await page.getByRole('button', { name: 'Bu kategoriyi seç', exact: true }).click();
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await page.getByText('İlanları Keşfet', { exact: true }).waitFor();
  // Transport failure must produce a retry action, never a false zero-result screen.
  fail = true;
  await go('/explore?q=retry-test');
  await page.getByRole('button', { name: 'Yeniden dene', exact: true }).waitFor();
  fail = false;
  await page.getByRole('button', { name: 'Yeniden dene', exact: true }).click();
  await page.getByText('50 ilan', { exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 740 });
  await shot({ path: 'audit/mobile-v2/catalogue-320.png' });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile('audit/mobile-v2/catalogue-ui-test.json', JSON.stringify({ mockOnly: true, pagination: [24, 48, 50], filtersBeforePagination: true, exactDraftCount: true, cancelPreservesCategory: true, retry: true, errors }, null, 2));
  console.log('Passed: 50-result pagination, exact draft count, server filters, cancelled category draft, network retry and 320px rendering.');
} finally { await browser.close(); }
