import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, errors, writes, go, shot } = await mobileAuthFixture({ authenticated: true });
try {
  await go('/create');
  await page.getByRole('button', { name: 'İlan kategorisi seç', exact: true }).click();
  await page.getByRole('textbox', { name: 'Kategorilerde ara', exact: true }).fill('BMW');
  await page.getByRole('button', { name: 'Vasıta / Otomobil / BMW', exact: true }).click();
  await page.getByRole('button', { name: 'Vasıta / Otomobil / BMW / Diğer Model', exact: true }).click();
  await page.getByRole('textbox', { name: 'Başlık', exact: true }).fill('Yerel test için özel ilan başlığı');
  await page.getByRole('button', { name: 'Taslaklarım', exact: true }).click();
  await page.getByRole('button', { name: 'Bu ilanı taslak olarak kaydet', exact: true }).click();
  await page.getByText('Taslak cihazına kaydedildi.', { exact: true }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole('button', { name: 'Taslağa devam et', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Taslağa devam et', exact: true }).click();
  await page.getByRole('textbox', { name: 'Başlık', exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Başlık', exact: true }).inputValue(), 'Yerel test için özel ilan başlığı');
  await page.getByRole('button', { name: 'Marka *: BMW', exact: true }).click();
  await page.getByRole('button', { name: 'Audi', exact: true }).click();
  await page.getByRole('button', { name: /^Model.*: Seçin$/, exact: false }).waitFor();
  await page.getByRole('button', { name: 'İlan kategorisi seç', exact: true }).click();
  await page.getByRole('textbox', { name: 'Kategorilerde ara', exact: true }).fill('Daire');
  await page.getByRole('button', { name: 'Emlak / Konut / Satılık / Daire', exact: true }).click();
  await page.getByRole('button', { name: 'Emlak / Konut / Satılık / Daire / 3+1', exact: true }).click();
  await page.getByRole('textbox', { name: 'm² (brüt)', exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Başlık', exact: true }).inputValue(), 'Yerel test için özel ilan başlığı');
  assert.equal(await page.getByRole('button', { name: /^Marka/ }).count(), 0);
  await shot({ path: 'audit/mobile-v2/create-category-fields.png' });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(writes.filter(w => w.table === 'listings').length, 0, 'Saving a draft must not publish');
  await writeFile('audit/mobile-v2/create-draft-test.json', JSON.stringify({ mockOnly: true, draftSurvivesReload: true, brandResetsModel: true, categoryResetsAttributes: true, customTitlePreserved: true, noPublication: true, errors }, null, 2));
  console.log('Passed: local draft/reload, brand/model reset, category-specific fields and preserved custom title.');
} catch (error) {
  console.error((await page.locator('body').innerText()).slice(0, 4500));
  throw error;
} finally { await browser.close(); }
