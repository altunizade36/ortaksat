import { chromium } from 'playwright';
const b = await chromium.launch();
const errors = [];
async function shot(name, url, width, actions) {
  const pg = await b.newPage({ viewport: { width, height: 1000 } });
  pg.on('pageerror', e => errors.push(`${name}: ${e.message.slice(0,120)}`));
  pg.on('console', m => { if (m.type()==='error' && !m.text().includes('418')) errors.push(`${name} console: ${m.text().slice(0,110)}`); });
  try {
    await pg.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await pg.waitForTimeout(3500);
    if (actions) await actions(pg);
    await pg.screenshot({ path: `_smoke_${name}.png` });
    console.log(`OK ${name} (${width}) ${pg.url()}`);
  } catch(e) { console.log(`ERR ${name}: ${e.message.slice(0,100)}`); }
  await pg.close();
}
const base = 'https://www.ortaksat.com';
await shot('home-d', base+'/', 1360);
await shot('explore-d', base+'/explore', 1360);
await shot('kategori-d', base+'/kategori/emlak', 1360);
await shot('search-d', base+'/explore?q=daire', 1360);
await shot('home-m', base+'/', 390);
await shot('explore-m', base+'/explore', 390);
// bir ilana git
const pg = await b.newPage({ viewport: { width: 1360, height: 1000 } });
await pg.goto(base+'/explore', { waitUntil:'networkidle', timeout:45000 });
await pg.waitForTimeout(3000);
const card = pg.locator('a[href*="/listing/"]').first();
if (await card.count()) { await card.click().catch(()=>{}); await pg.waitForTimeout(3500); await pg.screenshot({path:'_smoke_listing-d.png'}); console.log('OK listing-d', pg.url()); }
await pg.close();
console.log('--- ERRORS ---');
console.log(errors.length ? errors.join('\n') : 'none');
await b.close();
