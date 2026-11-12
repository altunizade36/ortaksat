import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { mobileAuthFixture } from './mobile-auth-fixture.mjs';
const { browser, page, go, api, listing, errors } = await mobileAuthFixture({ authenticated: true });
const origin = process.env.MOBILE_TEST_URL;
page.on('dialog', dialog => dialog.accept());
const html = await readFile('dist-check-mobile/contact-drafts-web/partnership-request/[id].html', 'utf8');
const proposal = process.env.DRAFT_MALFORMED === "1" ? null : { message: 'Kayıtlı başvuru mesajımı ve teklifimi koru.', extra: 'Yerel test', selected: ['Çevreme önerebilirim'], kind: 'rate', amount: '17' };
await page.addInitScript(({ id, proposal }) => {
  if (!localStorage.getItem('draft-test-initialized')) {
    localStorage.setItem('draft-test-initialized', '1');
    localStorage.setItem(`ortaksat_mobile_application:guest:${id}`, JSON.stringify(proposal));
  }
}, { id: listing.id, proposal });
let releaseListing;
const listingGate = new Promise(resolve => { releaseListing = resolve; });
try {
  await page.route(`${origin}/partnership-request/${listing.id}**`, route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.route(`${api}/rest/v1/listing_public_cards**`, async route => {
    const req = route.request(), id = new URL(req.url()).searchParams.get('id');
    if (id !== `eq.${listing.id}`) return route.fulfill({ json: [] });
    await listingGate;
    return route.fulfill({ json: req.headers().accept?.includes('vnd.pgrst.object') ? listing : [listing] });
  });
  await go(`/partnership-request/${listing.id}?resume=1`);
  await page.getByText('İlan yükleniyor…', { exact: true }).waitFor();
  releaseListing();
  const amount = page.getByRole('textbox', { name: 'Teklif Ettiğin Komisyon Tutarı', exact: true });
  await amount.waitFor();
  if (proposal) {
    assert.equal(await amount.inputValue(), '17');
    assert.equal(await page.getByRole('button', { name: '%  Yüzde ile Teklif Et', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('textbox', { name: 'Kendini ve ürünü nasıl tanıtacağını anlat...', exact: true }).inputValue(), proposal.message);
    await amount.fill('19');
    await page.getByRole('textbox', { name: 'Eklemek istediğin bir bilgi var mı?', exact: true }).fill('Form düzenlemeye devam edebiliyor.');
    assert.equal(await amount.inputValue(), '19');
  } else {
    assert.equal(await amount.inputValue(), '5000');
    assert.equal(await page.getByRole('textbox', { name: 'Kendini ve ürünü nasıl tanıtacağını anlat...', exact: true }).inputValue(), '');
  }
  assert.deepEqual(errors, []);
  await writeFile(`audit/web-review/application-draft-${proposal ? 'ui' : 'malformed'}.json`, JSON.stringify({ mockOnly: true, delayedListingPreservesProposal: true, restoredRate: proposal ? 17 : undefined, editingRemainsAvailable: true, malformedDraftUsesDefaults: !proposal, errors }, null, 2));
  console.log('Passed restored guest proposal with delayed listing after login: rate, amount, message and editable form.');
} catch (error) { console.error(errors, (await page.locator('body').innerText()).slice(-1500)); throw error; }
finally { await browser.close(); }
