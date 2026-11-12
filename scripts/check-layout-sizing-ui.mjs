import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { page, browser, go, api, listing, me, errors } = await mobileAuthFixture({ authenticated: true });
const categories = JSON.parse(await readFile('audit/mobile-v4/category-sizing-routes.json', 'utf8'));
const rows = Array.from({ length: 4 }, (_, i) => ({ ...listing, id: i ? `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, '0')}` : listing.id, title: `Ölçü kontrolü için farklı uzunlukta yerel ürün ${i+1}`, price: i ? 400 + i : 1900000 }));
let mode = 'empty';
const findings = [];
async function checkStrips(context) {
  const sizes = await page.getByTestId('horizontal-strip').evaluateAll(els => els.map(el => ({ height: el.getBoundingClientRect().height, text: el.textContent.slice(0, 100) })));
  for (const size of sizes) assert.ok(size.height > 0 && size.height <= 130, `${context}: stretched horizontal content ${JSON.stringify(size)}`);
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
  return sizes;
}
try {
  await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`, route => route.fulfill({ json: { listings: mode === 'empty' ? [] : rows, total: mode === 'empty' ? 0 : rows.length } }));
  await page.route(`${api}/rest/v1/favorites**`, route => route.fulfill({ json: rows.map((r,i) => ({ id: `fav-size-${i}`, listing_id: r.id, user_id: me, created_at: new Date().toISOString() })) }));
  await page.route(`${api}/rest/v1/listing_public_cards**`, route => route.fulfill({ json: rows }));
  if (!process.env.LAYOUT_CARD_WEB_ONLY) {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      mode = 'empty';
      for (const category of categories) {
        console.log(`Empty category ${category.slug} at ${width}`);
        await go(`/kategori/${category.slug}`);
        await page.getByText('Bu kriterlerde ilan bulunamadı', { exact: true }).waitFor();
        const initial = await checkStrips(category.slug);
        await page.getByRole('button', { name: 'Sahibinden', exact: true }).click();
        await page.getByText('Bu kriterlerde ilan bulunamadı', { exact: true }).waitFor();
        await checkStrips(`${category.slug} after owner filter`);
        if (category.firstChild) {
          const strip = page.getByTestId('horizontal-strip').first();
          await strip.getByRole('button', { name: category.firstChild.label, exact: true }).click();
          await page.getByRole('heading', { name: category.firstChild.label, exact: true }).waitFor();
          await page.getByText('Bu kriterlerde ilan bulunamadı', { exact: true }).waitFor();
          await checkStrips(`${category.slug} after subcategory`);
        }
        findings.push({ width, category: category.slug, empty: true, stripHeights: initial.map(x => x.height) });
      }
      mode = 'few';
      await go('/kategori/emlak');
      await page.getByTestId('catalogue-listing').first().waitFor();
      for (const rect of await page.getByTestId('catalogue-listing').evaluateAll(els => els.map(e => ({ height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width })))) assert.ok(rect.height >= 110 && rect.height < 230, JSON.stringify(rect));
      await checkStrips('category with products');
      await go('/partner?tab=requests');
      await page.getByText('Bu görünümde talep bulunmuyor.', { exact: true }).waitFor();
      await checkStrips('empty partnership requests');
      await page.getByRole('button', { name: 'Gönderdiğim (0)', exact: true }).click();
      await checkStrips('partnership requests after click');
    }
  }
  for (const width of process.env.LAYOUT_CARD_WEB_ONLY ? [320,390,1440] : [320,390]) {
    await page.setViewportSize({ width, height: 844 });
    await go('/favorites?view=collections');
    await page.getByTestId('listing-card').first().waitFor();
    assert.equal(await page.getByTestId('listing-card').count(), 4);
    async function cardSizes() {
      const sizes = [];
      for (const card of await page.getByTestId('listing-card').all()) {
        await card.scrollIntoViewIfNeeded();
        const box = await card.boundingBox();
        assert.ok(box.height > 200 && box.height < 700, `Oversized favorite card: ${JSON.stringify(box)}`);
        sizes.push(box.height);
      }
      return sizes;
    }
    const before = await cardSizes();
    const card = page.getByTestId('listing-card').first();
    await card.getByRole('button', { name: /^Karşılaştır/ }).click();
    const after = await cardSizes();
    after.forEach((height,i) => assert.ok(Math.abs(height - before[i]) < 3, `Card ${i} grew after compare: ${before[i]} -> ${height}`));
    await card.getByRole('button', { name: 'Koleksiyona ekle', exact: true }).click();
    await page.getByText('Oluştur ve ekle', { exact: true }).waitFor();
    await page.mouse.click(5, 420); // Close through the modal backdrop without saving.
    await page.getByText('Oluştur ve ekle', { exact: true }).waitFor({ state: 'hidden' });
    const closed = await cardSizes();
    closed.forEach((height,i) => assert.ok(Math.abs(height - before[i]) < 3, `Card ${i} grew after closing a sheet`));
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    await page.screenshot({ path: `audit/mobile-v4/favorite-sizing-${width}.png`, animations: 'disabled' });
    findings.push({ width, favoriteHeights: before, stableAfterCompareAndSheet: true });
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(`audit/mobile-v4/layout-sizing-${process.env.LAYOUT_CARD_WEB_ONLY ? 'web' : 'mobile'}.json`, JSON.stringify({ mockOnly: true, findings, errors }, null, 2));
  console.log('Passed category/strip/card sizing: empty and populated pages, repeated category/filter clicks, partnership tabs, favorite cards, compare and collection dialog.');
} catch (error) {
  console.error(page.url(), (await page.locator('body').innerText()).slice(-3000));
  await page.screenshot({ path: 'audit/mobile-v4/layout-sizing-failure.png', timeout: 15000 });
  throw error;
} finally { await browser.close(); }
