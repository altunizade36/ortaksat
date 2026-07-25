const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'https://www.ortaksat.com';
const OUT = process.argv[2];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function raw(path, ua) {
  const res = await fetch(BASE + path, { headers: ua ? { 'User-Agent': ua } : {}, redirect: 'manual' });
  const status = res.status;
  const ct = res.headers.get('content-type');
  const loc = res.headers.get('location');
  let text = '';
  try { text = await res.text(); } catch {}
  return { path, status, ct, loc, len: text.length, text };
}

(async () => {
  const out = { generatedAt: new Date().toISOString() };
  // robots + sitemap
  const robots = await raw('/robots.txt');
  out.robots = { status: robots.status, ct: robots.ct, len: robots.len, body: robots.text.slice(0, 800) };
  const sm = await raw('/sitemap.xml');
  out.sitemap = { status: sm.status, ct: sm.ct, len: sm.len, head: sm.text.slice(0, 600) };
  // extract some urls from sitemap
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  out.sitemapCount = locs.length;
  out.sitemapSample = locs.slice(0, 20);
  const catUrls = locs.filter(u => u.includes('/kategori/')).slice(0, 3);
  const listUrls = locs.filter(u => u.includes('/listing/')).slice(0, 3);
  out.catUrls = catUrls; out.listUrls = listUrls;

  // 404 test
  const nf = await raw('/xyzabc-does-not-exist-123');
  out.notFound = { status: nf.status, len: nf.len, hasTurkish404: /bulunam|404|sayfa/i.test(nf.text) };

  // Googlebot SEO on dynamic pages via headless render
  const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  const browser = await chromium.launch({ headless: true });
  out.dynamic = [];
  const dynTargets = [];
  if (catUrls[0]) dynTargets.push(catUrls[0].replace(BASE, ''));
  if (listUrls[0]) dynTargets.push(listUrls[0].replace(BASE, ''));
  // fallback known category slug
  if (dynTargets.length === 0) dynTargets.push('/kategori/emlak');

  for (const t of dynTargets) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, userAgent: GOOGLEBOT });
    const page = await ctx.newPage();
    const consoleErrors = [], netErr = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    page.on('response', r => { if (r.status() >= 400) netErr.push({ s: r.status(), u: r.url().slice(0, 150) }); });
    let status = null, err = null;
    try { const resp = await page.goto(BASE + t, { waitUntil: 'domcontentloaded', timeout: 45000 }); status = resp && resp.status(); await sleep(4000); }
    catch (e) { err = String(e.message).slice(0, 200); }
    let info = {};
    try {
      const body = await page.evaluate(() => document.body ? document.body.innerText : '');
      const crash = /bir şeyler ters gitti|something went wrong|react error #130/i.test(body);
      info = await page.evaluate(() => {
        const g = (s, a) => { const e = document.querySelector(s); return e ? e.getAttribute(a) : null; };
        return { title: document.title, description: g('meta[name="description"]', 'content'), canonical: g('link[rel="canonical"]', 'href'), robots: g('meta[name="robots"]', 'content') };
      });
      info.crash = crash; info.bodyLen = body.length;
    } catch (e) { err = (err || '') + ' EVAL' + String(e.message).slice(0, 100); }
    out.dynamic.push({ path: t, status, err, ...info, consoleErrors: consoleErrors.slice(0, 5), netErr: netErr.slice(0, 6) });
    await ctx.close();
  }

  // Responsive 390 + broken links on homepage
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(4000);
  out.mobileHome = await page.evaluate(() => ({ scrollWidth: document.body.scrollWidth, innerWidth: window.innerWidth, overflow: document.body.scrollWidth > window.innerWidth + 2 }));
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href')).filter(h => h && !h.startsWith('#') && !h.startsWith('mailto') && !h.startsWith('tel')));
  const internal = [...new Set(links.filter(h => h.startsWith('/') || h.startsWith(BASE)))].slice(0, 25);
  out.homeLinkCount = links.length; out.internalLinksSample = internal;
  await ctx.close();

  // sample-check internal links (fetch)
  out.brokenLinks = [];
  for (const l of internal.slice(0, 15)) {
    const p = l.startsWith(BASE) ? l.replace(BASE, '') : l;
    try { const r = await fetch(BASE + p, { redirect: 'manual' }); if (r.status >= 400) out.brokenLinks.push({ path: p, status: r.status }); }
    catch (e) { out.brokenLinks.push({ path: p, err: String(e.message).slice(0, 80) }); }
  }

  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  process.stderr.write('DONE\n');
})();
