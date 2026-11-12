import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { page, browser, go, api, me, errors } = await mobileAuthFixture({ authenticated: true });
const routes = ['/hakkimizda', '/sss', '/iletisim', '/gizlilik-politikasi', '/kullanim-sartlari', '/kvkk', '/notifications'];
const findings = [];
const now = new Date().toISOString();
try {
  await page.route(`${api}/rest/v1/notifications?**`, route => route.fulfill({ json: [{ id: 'info-test', user_id: me, type: 'system', title: 'Yerel test duyurusu', body: 'Bu duyurunun ayrıntıları bir geçici bildirim yerine tam ekranda okunabilir.', created_at: now, read: false, metadata: {} }] }));
  for (const route of routes) {
    console.log(`Checking ${route}`);
    await go(route);
    const footer = page.getByTestId('compact-footer');
    await footer.waitFor({ state: 'attached' });
    assert.equal(await footer.count(), 1, route);
    assert.equal(await footer.getByRole('link').count(), 6, route);
    await footer.scrollIntoViewIfNeeded();
    const box = await footer.boundingBox(), nav = await page.getByTestId('mobile-bottom-nav').last().boundingBox();
    assert.ok(box.height >= 120 && box.height <= 180, `${route}: height ${box.height}`);
    assert.ok(Math.abs(box.x) <= 1 && Math.abs(box.width - 390) <= 1, `${route}: full-width ${JSON.stringify(box)}`);
    assert.ok(Math.abs(box.y + box.height - nav.y) <= 2, `${route}: footer must end at the bottom navigation (${box.y + box.height} vs ${nav.y})`);
    findings.push({ route, footerHeight: box.height, footerBottom: box.y + box.height, navigationTop: nav.y });
  }
  await go('/sss');
  await page.getByRole('textbox', { name: 'Sorularında ara…', exact: true }).fill('cevabı-olmayan-yerel-örnek');
  await page.getByRole('button', { name: 'Aramayı ve Filtreleri Temizle', exact: true }).click();
  await page.getByRole('button', { name: 'İlan nasıl verilir?', exact: true }).click();
  await page.getByText(/Alt menüdeki İlan Ver düğmesini kullan/).waitFor();
  await go('/iletisim');
  await page.getByRole('button', { name: 'E-posta Taslağını Aç', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'en az 20 karakter' }).waitFor();
  await page.getByRole('textbox', { name: 'İletişim mesajı', exact: true }).fill('Yalnız yerel arayüz kontrolü; e-posta gönderilmez.');
  assert.equal(await page.getByRole('link', { name: 'Destek Taleplerime Git', exact: true }).getAttribute('href'), '/support');
  await go('/gizlilik-politikasi');
  await page.getByRole('textbox', { name: 'Belgede ara', exact: true }).fill('eşleşmeyen-yerel-örnek');
  await page.getByRole('button', { name: 'Tüm metni göster', exact: true }).click();
  await page.getByRole('button', { name: '1. Veri Sorumlusu ve Kapsam', exact: true }).click();
  await page.getByRole('button', { name: 'Tüm bölümler', exact: true }).click();
  await go('/notifications');
  await page.getByRole('button', { name: 'Yerel test duyurusu', exact: true }).click();
  await page.getByText('Bildirim Detayı', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Bildirimlere Dön', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  await go('/iletisim');
  await page.getByTestId('compact-footer').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
  await page.screenshot({ path: 'audit/mobile-v4/contact-footer-320.png', animations: 'disabled' });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile('audit/mobile-v4/information-ui-results.json', JSON.stringify({ mockOnly: true, findings, helpSearch: true, legalSearch: true, contactValidation: true, notificationDetail: true, width320: true, emailSent: false, errors }, null, 2));
  console.log('Passed: seven information/notification screens, fixed footer boundary, help/legal search, contact validation and notification details. No email sent.');
} catch (error) {
  console.error(page.url(), (await page.locator('body').innerText()).slice(-5000));
  await page.screenshot({ path: 'audit/mobile-v4/information-ui-failure.png', timeout: 15000 });
  throw error;
} finally { await browser.close(); }
