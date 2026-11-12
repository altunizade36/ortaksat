import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, go, errors } = await mobileAuthFixture({ authenticated: true });
try {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go('/hakkimizda');
    await page.getByRole('link', { name: 'İletişim', exact: true }).first().click();
    await page.waitForURL(/\/iletisim/);
    await page.getByRole('button', { name: 'Geri', exact: true }).first().click();
    await page.waitForURL(/\/hakkimizda/);
  }
  assert.deepEqual(errors, []);
  await writeFile('audit/web-review/back-navigation-ui.json', JSON.stringify({ widths: [390, 1440], previousPageRestored: true, errors }, null, 2));
  console.log('Passed: mobile and desktop web header Back restores the previous information page.');
} finally { await browser.close(); }
