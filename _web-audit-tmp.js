const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://www.ortaksat.com';
const PAGES = [
  '/', '/explore', '/create', '/partner', '/kategoriler', '/auth',
  '/nasil-calisir', '/blog'
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = { pages: [], generatedAt: new Date().toISOString() };

async function auditPage(browser, path, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: opts.ua || undefined,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const networkErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => pageErrors.push(String(err.message || err).slice(0, 300)));
  page.on('response', (resp) => {
    const s = resp.status();
    if (s >= 400) {
      const u = resp.url();
      // ignore third-party analytics/fonts noise but record supabase/self
      networkErrors.push({ status: s, url: u.slice(0, 200) });
    }
  });
  let httpStatus = null;
  let error = null;
  try {
    const resp = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    httpStatus = resp ? resp.status() : null;
    await sleep(4500);
  } catch (e) {
    error = String(e.message || e).slice(0, 300);
  }
  let crash = false, crashText = null, title = null, bodyLen = 0;
  let overflow = null, meta = {};
  try {
    const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
    bodyLen = bodyText.length;
    const crashSignals = ['bir şeyler ters gitti', 'bir seyler ters gitti', 'Something went wrong', 'Minified React error #130', 'Application error'];
    for (const sig of crashSignals) {
      if (bodyText.toLowerCase().includes(sig.toLowerCase())) { crash = true; crashText = sig; break; }
    }
    title = await page.title();
    meta = await page.evaluate(() => {
      const g = (sel, attr) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : null; };
      return {
        description: g('meta[name="description"]', 'content'),
        canonical: g('link[rel="canonical"]', 'href'),
        ogTitle: g('meta[property="og:title"]', 'content'),
        robots: g('meta[name="robots"]', 'content'),
      };
    });
    overflow = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
      overflow: document.body.scrollWidth > window.innerWidth + 2,
    }));
  } catch (e) {
    error = (error || '') + ' EVAL:' + String(e.message).slice(0, 150);
  }
  await ctx.close();
  return { path, httpStatus, error, crash, crashText, title, bodyLen,
    consoleErrors: consoleErrors.slice(0, 8), pageErrors: pageErrors.slice(0, 5),
    networkErrors: networkErrors.slice(0, 12), meta, overflow };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const p of PAGES) {
    process.stderr.write('auditing ' + p + '\n');
    try {
      const r = await auditPage(browser, p);
      results.pages.push(r);
    } catch (e) {
      results.pages.push({ path: p, fatal: String(e.message).slice(0, 200) });
    }
  }
  await browser.close();
  fs.writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
  process.stderr.write('DONE\n');
})();
