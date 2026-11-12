import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, api, listing, me, seller, errors, go, shot } = await mobileAuthFixture({ authenticated: true });
const own = { ...listing, owner_id: me, title: 'Yönetilen Test İlanı' };
const partnerListing = { ...listing, id: '77777777-7777-4777-8777-777777777777', title: 'Ortak Olduğum İlan' };
const requests = [1, 2].map(n => ({ id: `88888888-8888-4888-8888-88888888888${n}`, listing_id: own.id, partner_id: seller, status: 'pending', ref_code: `sample-${n}`, note: `Yerel test başvurusu ${n}`, created_at: new Date().toISOString() }));
const active = { ...requests[0], id: '99999999-9999-4999-8999-999999999999', listing_id: partnerListing.id, partner_id: me, status: 'active', agreed_commission_type: 'fixed', agreed_commission_value: 5000 };
const writes = [];
try {
  await page.route(`${api}/rest/v1/**`, async route => {
    const request = route.request(), table = new URL(request.url()).pathname.split('/').at(-1);
    let data;
    if (table === 'listing_public_cards') data = [own, partnerListing];
    else if (table === 'partnerships') {
      if (request.method() === 'PATCH') { writes.push({ table, body: request.postDataJSON() }); data = {id:new URL(request.url()).searchParams.get('id')?.replace('eq.','')}; }
      else data = [...requests, active];
    } else if (table === 'listings' && request.method() === 'PATCH') { writes.push({ table, body: request.postDataJSON() }); data = {id:new URL(request.url()).searchParams.get('id')?.replace('eq.','')}; }
    else { await route.fallback(); return; }
    const single = request.headers().accept?.includes('vnd.pgrst.object');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single && Array.isArray(data) ? data[0] : data) });
  });
  await go('/profile');
  await page.getByRole('button', { name: 'Profili Düzenle', exact: true }).waitFor({ timeout: 60000 });
  await page.getByText('Yerel test başvurusu 1', { exact: true }).waitFor();
  await shot({ path: 'audit/mobile-v2/profile-management-390.png' });
  await page.getByRole('button', { name: 'Onayla', exact: true }).first().click();
  await page.getByRole('button', { name: 'Onayla', exact: true }).last().click();
  await page.waitForTimeout(400);
  assert.ok(writes.some(w => w.table === 'partnerships' && w.body.status === 'active'));
  await page.getByRole('button', { name: 'Reddet', exact: true }).first().click();
  await page.getByRole('button', { name: 'Reddet', exact: true }).last().click();
  await page.waitForTimeout(400);
  assert.ok(writes.some(w => w.table === 'partnerships' && w.body.status === 'rejected'));
  await page.getByRole('tab', { name: 'Ortaklıklarım', exact: true }).click();
  await page.getByText('Ortak Olduğum İlan', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Onay bekliyor', exact: true }).click();
  await page.getByText('Bu durumda bir ortaklığın yok. İlan detayından ortaklık başvurusu yapabilirsin.', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'İlanlarım', exact: true }).click();
  await page.getByRole('button', { name: 'Yönetilen Test İlanı yönet', exact: true }).click();
  await page.getByRole('button', { name: 'Yayından Kaldır', exact: true }).click();
  await page.getByRole('button', { name: 'Onayla', exact: true }).click();
  await page.waitForTimeout(400);
  assert.ok(writes.some(w => w.table === 'listings' && w.body.status === 'paused'));
  await page.setViewportSize({ width: 320, height: 740 });
  await shot({ path: 'audit/mobile-v2/profile-management-320.png' });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile('audit/mobile-v2/profile-management-test.json', JSON.stringify({ mockOnly: true, approve: true, reject: true, pause: true, filteredEmptyState: true, errors }, null, 2));
  console.log('Passed: profile dashboard, approve/reject requests, filtered partnerships and pause listing through isolated persistence mocks.');
} finally { await browser.close(); }
