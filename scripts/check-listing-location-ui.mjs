import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';

const { page, browser, go, api, writes, errors } = await mobileAuthFixture({ authenticated: true });
let fail = true;
const queries = [];
try {
  await page.route(`${api}/rest/v1/neighborhoods?**`, async route => {
    const district = Number(new URL(route.request().url()).searchParams.get('district_id')?.replace('eq.', ''));
    queries.push(district);
    if (fail) return route.fulfill({ status: 503, json: { message: 'Local neighborhood failure' } });
    await route.fulfill({ json: [{ id: 123456, province_id: 34, district_id: district, name: 'Örnek Mahallesi', slug: 'ornek' }] });
  });
  await go('/create');
  await page.getByRole('textbox', { name: 'Başlık', exact: true }).fill('Konum alanları için yerel deneme');
  assert.equal(await page.getByRole('button', { name: /^İlçe \*:/ }).isDisabled(), true);
  async function choose(field, value, query = value) {
    await page.getByRole('button', { name: new RegExp(`^${field} \\*:`) }).click();
    await page.getByRole('textbox', { name: 'Ara…', exact: true }).fill(query);
    await page.getByRole('button', { name: value, exact: true }).click();
    await page.getByRole('textbox', { name: 'Ara…', exact: true }).waitFor({ state: 'hidden' });
  }
  await choose('İl', 'İstanbul', 'istanbul');
  await choose('İlçe', 'Kadıköy', 'kadikoy');
  await page.getByText('Mahalle listesi yüklenemedi. Tekrar deneyebilir veya mahalle adını yazabilirsin.', { exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Mahalle / Köy', exact: true }).fill('Deneme Mahallesi');
  const preview = page.getByTestId('listing-location-preview');
  assert.ok((await preview.innerText()).includes('İstanbul / Kadıköy / Deneme Mahallesi'));
  await page.getByRole('radio', { name: 'Yalnız il', exact: true }).click();
  assert.ok(!(await preview.innerText()).includes('Kadıköy'));
  await page.getByRole('radio', { name: 'İl ve ilçe', exact: true }).click();
  assert.ok((await preview.innerText()).includes('İstanbul / Kadıköy'));
  assert.ok(!(await preview.innerText()).includes('Deneme Mahallesi'));
  fail = false;
  await page.getByRole('button', { name: 'Mahalleleri yeniden yükle', exact: true }).click();
  await page.getByRole('button', { name: /^Mahalle \/ Köy:/ }).click();
  await page.getByRole('button', { name: 'Örnek Mahallesi', exact: true }).click();
  await page.getByRole('radio', { name: 'Mahalleye kadar', exact: true }).click();
  assert.ok((await preview.innerText()).includes('Örnek Mahallesi'));
  await choose('İl', 'İstanbul', 'istanbul');
  assert.ok((await preview.innerText()).includes('Kadıköy / Örnek Mahallesi'), 'Selecting the same province must preserve its district/neighborhood');
  await page.waitForFunction(() => Object.keys(localStorage).some(k => {
    try { const d = JSON.parse(localStorage.getItem(k)); return k.includes('draft') && d.loc?.neighborhoodId === 123456; } catch { return false; }
  }));
  await choose('İl', 'Ankara', 'ankara');
  assert.equal(await page.getByRole('button', { name: /^İlçe \*: İlçe seçin$/ }).count(), 1);
  assert.equal(await page.getByRole('textbox', { name: 'Mahalle / Köy', exact: true }).inputValue(), '');
  assert.equal(await page.getByRole('textbox', { name: 'Mahalle / Köy', exact: true }).isEditable(), false);
  assert.ok(!(await preview.innerText()).includes('Kadıköy'));
  await page.setViewportSize({ width: 320, height: 844 });
  await preview.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
  await page.screenshot({ path: 'audit/mobile-v4/listing-location-320.png', animations: 'disabled' });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(writes.filter(w => w.table === 'listings').length, 0);
  await writeFile('audit/mobile-v4/listing-location-results.json', JSON.stringify({ mockOnly: true, provinceDistrictCascade: true, turkishSearch: true, neighborhoodRetry: true, manualEntry: true, visibilityPreview: true, selectedNeighborhoodIdSavedInDraft: true, sameProvincePreservesSelection: true, width320: true, queries, errors, noPublication: true }, null, 2));
  console.log('Passed listing location: Turkish search, province/district cascade, failed neighborhood retry, manual entry, visibility preview, neighborhood ID draft and 320px.');
} catch (error) {
  console.error((await page.locator('body').innerText()).slice(-7000));
  await page.screenshot({ path: 'audit/mobile-v4/listing-location-failure.png', timeout: 15000 });
  throw error;
} finally { await browser.close(); }
