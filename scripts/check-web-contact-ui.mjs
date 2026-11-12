import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';

const { browser, page, go, api, listing, me, seller, errors, writes } = await mobileAuthFixture({ authenticated: true });
const rows = ['message', 'phone', 'whatsapp'].map((method, i) => ({ ...listing, id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i + 1).padStart(12, '0')}`, title: `Web ${method} iletişim test ilanı`, contact_method: method }));
let phoneCalls = 0, failPhone = true, releasePhone;
await page.addInitScript(() => { window.__contactLinks = []; window.open = url => { window.__contactLinks.push(String(url)); return { closed: false }; }; });
try {
  await page.route(`${api}/rest/v1/favorites**`, route => route.fulfill({ json: rows.map((r, i) => ({ id: `contact-fav-${i}`, listing_id: r.id, user_id: me, created_at: new Date().toISOString() })) }));
  await page.route(`${api}/rest/v1/listing_public_cards**`, route => {
    const req = route.request(), id = new URL(req.url()).searchParams.get('id')?.replace('eq.', '');
    const found = id ? rows.filter(r => r.id === id) : rows;
    return route.fulfill({ json: req.headers().accept?.includes('vnd.pgrst.object') ? found[0] || null : found });
  });
  await page.route(`${api}/rest/v1/rpc/reveal_seller_phone`, async route => {
    phoneCalls++;
    if (failPhone) { await new Promise(resolve => { releasePhone = resolve; }); return route.fulfill({ status: 503, json: { message: 'Local phone lookup outage' } }); }
    return route.fulfill({ json: '05550000000' });
  });
  // Missing optional seller profile must not silently disable the message action.
  await page.route(`${api}/rest/v1/profiles**`, route => {
    const req = route.request(), id = new URL(req.url()).searchParams.get('id');
    const profiles = id === `eq.${seller}` ? [] : [{ id: me, full_name: 'Örnek Kullanıcı', role: 'user', status: 'active' }];
    return route.fulfill({ json: req.headers().accept?.includes('vnd.pgrst.object') ? profiles[0] || null : profiles });
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go('/favorites?view=collections');
    await page.getByText(rows[0].title, { exact: true }).first().click();
    assert.equal(await page.getByRole('button', { name: 'Numarayı göster', exact: true }).count(), 0);
    await page.getByRole('button', { name: /^Satın Al/ }).first().click();
    await page.waitForURL(/\/(?:chat\/|messages\?c=)/); assert.equal(phoneCalls, width === 390 ? 0 : 3);
    await go('/favorites?view=collections');
    await page.getByText(rows[1].title, { exact: true }).first().click();
    failPhone = true;
    const reveal = page.getByRole('button', { name: 'Numarayı göster', exact: true });
    await reveal.click(); await page.waitForFunction(() => document.body.innerText.includes('Yükleniyor…'));
    assert.equal(await reveal.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: /^Satın Al/ }).first().isDisabled(), true);
    releasePhone();
    await page.getByText('Telefon bilgisi alınamadı. Tekrar deneyebilirsin.', { exact: true }).waitFor();
    failPhone = false; await reveal.click();
    await page.getByRole('button', { name: 'Ara: 05550000000', exact: true }).waitFor();
    await go('/favorites?view=collections');
    await page.getByText(rows[2].title, { exact: true }).first().click();
    await page.getByRole('button', { name: /^Satın Al/ }).first().click();
    await page.waitForFunction(n => window.__contactLinks.filter(u => u.startsWith('https://wa.me/')).length >= n, 1);
    assert.match((await page.evaluate(() => window.__contactLinks)).at(-1), /^https:\/\/wa.me\/905550000000\?text=/);
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
  }
  assert.deepEqual(errors, []);
  await writeFile('audit/web-review/web-contact-ui.json', JSON.stringify({ mockOnly: true, widths: [390, 1440], phoneCalls, messageWrites: writes.filter(w => w.table === 'messages').length, errors }, null, 2));
  console.log('Passed web preferred contact, profile-independent messaging, phone outage/retry, busy guards and WhatsApp at 390/1440px.');
} catch (error) { console.error({phoneCalls, links: await page.evaluate(() => window.__contactLinks)}, page.url(), (await page.locator('body').innerText()).slice(-1600)); throw error; }
finally { await browser.close(); }
