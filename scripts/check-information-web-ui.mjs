import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { page, browser, go, api, listing, errors } = await mobileAuthFixture({ authenticated: true });
const findings = [];
try {
  await page.route(`${api}/rest/v1/rpc/mobile_catalogue_page`, route => route.fulfill({ json: { listings: [listing], total: 1 } }));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ['/hakkimizda', '/sss', '/iletisim', '/gizlilik-politikasi', '/kullanim-sartlari', '/kvkk', '/partner']) {
      console.log(`Checking ${route} at ${width}`);
      await go(route);
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
      if (width < 760) {
        const footer = page.getByTestId('compact-footer');
        await footer.waitFor({ state: 'attached' });
        assert.equal(await footer.count(), 1);
        await footer.scrollIntoViewIfNeeded();
        const box = await footer.boundingBox();
        assert.ok(Math.abs(box.width - width) <= 1 && Math.abs(box.x) <= 1, JSON.stringify(box));
        assert.equal(box.height, 148);
      }
      findings.push({ width, route, noOverflow: true });
    }
  }
  await go('/gizlilik-politikasi');
  await page.getByRole('textbox', { name: 'Belgede ara', exact: true }).fill('eşleşmeyen-test-sözcüğü');
  await page.getByRole('button', { name: 'Tüm metni göster', exact: true }).click();
  await go('/partner');
  await page.getByText('Ortak Satış Fırsatları', { exact: true }).waitFor();
  await page.getByRole('button', { name: `Ortaklık ilanı: ${listing.title}`, exact: true }).waitFor();
  await page.screenshot({ path: 'audit/web-review/opportunities-1440.png', animations: 'disabled' });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile('audit/web-review/information-ui-results.json', JSON.stringify({ mockOnly: true, findings, webOpportunities: true, legalSearch: true, errors }, null, 2));
  console.log('Passed web information/opportunity pages: seven routes at 320/390/1440px, consistent compact footer, legal search and actual opportunity cards.');
} catch (error) {
  console.error(page.url(), (await page.locator('body').innerText()).slice(-3000));
  await page.screenshot({ path: 'audit/web-review/information-ui-failure.png', timeout: 15000 });
  throw error;
} finally { await browser.close(); }
