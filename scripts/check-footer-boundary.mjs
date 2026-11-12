import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { page, browser, go, errors } = await mobileAuthFixture({ authenticated: true });
const findings = [];
try {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/', '/explore', '/partner', '/seller', '/profile', '/messages', '/menu', '/create']) {
      console.log(`Checking ${route} at ${width}`);
      await go(route);
      const footer = page.getByTestId('compact-footer');
      await footer.waitFor({ state: 'attached' });
      assert.equal(await footer.count(), 1, `${route} footer count`);
      await footer.scrollIntoViewIfNeeded();
      const box = await footer.boundingBox(), navLocator = page.getByTestId('mobile-bottom-nav').last();
      const nav = await navLocator.count() ? await navLocator.boundingBox() : null;
      assert.ok(Math.abs(box.width - width) <= 1 && Math.abs(box.x) <= 1, `${route} width ${JSON.stringify(box)}`);
      assert.ok(Math.abs(box.height - 112) <= 1, `${route} height ${box.height}`);
      if (nav) assert.ok(Math.abs(box.y + box.height - nav.y) <= 2, `${route} footer bottom ${box.y + box.height}, nav ${nav.y}`);
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
      findings.push({ width, route, footerHeight: box.height, footerBottom: box.y + box.height, navTop: nav?.y ?? null });
    }
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile('audit/mobile-v4/footer-boundary-results.json', JSON.stringify({ mockOnly: true, findings, errors }, null, 2));
  console.log('Passed: eight tabs/routes at 320/390px, full-width 112px footer aligned to the bottom navigation, no overflow.');
} catch (error) {
  console.error(page.url(), (await page.locator('body').innerText()).slice(-2500));
  await page.screenshot({ path: 'audit/mobile-v4/footer-boundary-failure.png', timeout: 15000 });
  throw error;
} finally { await browser.close(); }
