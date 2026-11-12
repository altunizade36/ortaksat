import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';

const { page, browser, go, errors, writes, shot } = await mobileAuthFixture({ authenticated: true });
const findings = [];
try {
  for (const route of ['/', '/explore', '/partner', '/profile', '/messages']) {
    console.log(`Checking ${route}`);
    await go(route);
    const footer = page.getByTestId('compact-footer').last();
    await footer.waitFor({ state: 'attached' });
    assert.equal(await footer.getByRole('link').count(), 6, route);
    const height = await footer.evaluate(el => el.getBoundingClientRect().height);
    assert.ok(height >= 120 && height <= 180, `${route}: ${height}px`);
    const nav = page.getByTestId('mobile-bottom-nav').last();
    assert.deepEqual(await nav.getByRole('button').allTextContents().then(v => v.map(s => s.replace(/[^\p{L}\s]/gu, '').trim())), ['Ana Sayfa', 'Keşfet', 'İlan Ver', 'Ortak Satış', 'Menü']);
    findings.push({ route, footerHeight: height, links: 6 });
  }
  console.log('Checking create draft and photos');
  await go('/create');
  await page.getByRole('textbox', { name: 'Başlık', exact: true }).fill('Fotoğraflı deneme ilanı');
  await page.waitForFunction(() => Object.keys(localStorage).some(k => k.includes('draft') && localStorage.getItem(k)?.includes('Fotoğraflı deneme ilanı')));
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.includes('draft') && localStorage.getItem(k)?.includes('Fotoğraflı deneme ilanı'));
    const draft = JSON.parse(localStorage.getItem(key));
    draft.images = Array.from({ length: 5 }, (_, i) => `${location.origin}/demo/001-bmw-3-20i-premium-line.jpg?local-photo=${i}`);
    localStorage.setItem(key, JSON.stringify(draft));
  });
  console.log('Reloading saved photo draft');
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole('button', { name: 'Taslağa devam et', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Başlık', exact: true }).inputValue(), 'Fotoğraflı deneme ilanı');
  assert.equal(await page.getByRole('button', { name: 'Fotoğraf ekle', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Fotoğraf 3 büyüt', exact: true }).click();
  await page.getByRole('button', { name: 'Kapak Yap', exact: true }).click();
  await page.getByRole('button', { name: 'Fotoğrafı kapat', exact: true }).click();
  await page.waitForFunction(() => Object.keys(localStorage).some(k => k.includes('draft') && (() => { try { return JSON.parse(localStorage.getItem(k)).images?.[0]?.endsWith('local-photo=2'); } catch { return false; } })()));
  await page.getByRole('button', { name: 'Fotoğraf 2 büyüt', exact: true }).click();
  await page.getByRole('button', { name: 'Fotoğrafı Kaldır', exact: true }).click();
  await page.getByRole('button', { name: 'Fotoğraf ekle', exact: true }).waitFor();
  await page.getByRole('button', { name: '4. Önizleme', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'bir kategori seç' }).first().waitFor();
  await page.setViewportSize({ width: 320, height: 844 });
  const footer = page.getByTestId('compact-footer').last();
  await footer.scrollIntoViewIfNeeded();
  const box = await footer.boundingBox();
  assert.ok(box.height <= 180 && box.x >= 0 && box.x + box.width <= 320);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'audit/mobile-v4/compact-footer-320.png', animations: 'disabled', timeout: 15000 });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(writes.filter(w => w.table === 'listings').length, 0);
  await writeFile('audit/mobile-v4/footer-create-results.json', JSON.stringify({ mockOnly: true, findings, partialDraftRestored: true, photoLimit: 5, coverChanged: true, removal: true, missingCategoryBlocked: true, noPublication: true, errors }, null, 2));
  console.log('Passed: six footer links and stable navigation across five tabs; partial draft, five photos, gallery, cover, remove and preview validation.');
} finally { await browser.close(); }
