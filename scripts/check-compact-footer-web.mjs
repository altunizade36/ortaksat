import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { page, browser, go, errors, shot } = await mobileAuthFixture({ authenticated: true });
const findings = [];
try {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/', '/explore', '/partner', '/seller', '/messages', '/profile', '/menu', '/create']) {
      await go(route);
      const footer = page.getByTestId('compact-footer');
      await footer.first().waitFor({ state: 'attached' });
      assert.equal(await footer.count(), 1, `${route}: one footer`);
      const links = await footer.getByRole('link').evaluateAll(els => els.map(el => el.getAttribute('href')));
      assert.deepEqual(links, ['/hakkimizda', '/sss', '/iletisim', '/gizlilik-politikasi', '/kullanim-sartlari', '/kvkk', '/hesap-silme']);
      const box = await footer.boundingBox();
      assert.ok(box.height >= 100 && box.height <= 125 && box.x >= 0 && box.x + box.width <= width + 1, `${route}: ${JSON.stringify(box)}`);
      findings.push({ width, route, height: box.height, links: links.length });
      if (route === '/') { await footer.scrollIntoViewIfNeeded(); await shot({ path: `audit/web-review/compact-footer-${width}.png` }); }
    }
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile('audit/web-review/compact-footer-results.json', JSON.stringify({ mockOnly: true, findings, errors }, null, 2));
  console.log('Passed compact web footer: eight routes at 320px and 390px, seven correct links, no duplicate footer or horizontal overflow.');
} finally { await browser.close(); }
