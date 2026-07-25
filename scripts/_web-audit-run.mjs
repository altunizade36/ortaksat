// WEB MODULE AUDIT — canlı www.ortaksat.com'a karşı Playwright.
// domcontentloaded + waitForTimeout (networkidle TAKILIR — heartbeat polling).
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = "https://www.ortaksat.com";
const OUT = "audit/_web-audit-data.json";

const LISTING_ID = "0bf41c94-9e37-499a-aa84-227da1d3ab5b";
const CAT_SLUGS = ["emlak", "vasita", "yedek-parca-aksesuar-ve-tuning"];

const PAGES = [
  { path: "/", name: "home" },
  { path: "/explore", name: "explore" },
  { path: "/create", name: "create" },
  { path: "/partner", name: "partner" },
  { path: "/kategoriler", name: "kategoriler" },
  { path: "/auth", name: "auth" },
  { path: "/nasil-calisir", name: "nasil-calisir" },
  { path: "/blog", name: "blog" },
  { path: "/kategori/emlak", name: "kategori-emlak" },
  { path: "/kategori/vasita", name: "kategori-vasita" },
  { path: `/listing/${LISTING_ID}`, name: "listing" },
];

const CRASH_MARKERS = ["bir şeyler ters gitti", "bir seyler ters gitti", "Something went wrong", "Minified React error #130", "Error: Minified React error", "Application error"];

const result = { base: BASE, ts: new Date().toISOString(), pageChecks: [], seo: [], sitemap: {}, robots: {}, notFound: {}, brokenLinks: {}, responsive: [], webVitals: [], errors: [] };

async function checkPage(browser, pg) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const networkErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on("response", (r) => { const s = r.status(); if (s >= 400) networkErrors.push({ url: r.url().slice(0, 200), status: s }); });
  let httpStatus = null, crashDetected = false, bodyLen = 0;
  try {
    const resp = await page.goto(`${BASE}${pg.path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    httpStatus = resp ? resp.status() : null;
    await page.waitForTimeout(5000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    bodyLen = bodyText.length;
    for (const mk of CRASH_MARKERS) { if (bodyText.includes(mk)) { crashDetected = true; break; } }
  } catch (e) {
    result.errors.push({ page: pg.name, phase: "goto", err: String(e.message || e).slice(0, 200) });
  }
  await ctx.close();
  return {
    name: pg.name, path: pg.path, httpStatus, crashDetected, bodyLen,
    consoleErrors: consoleErrors.slice(0, 15), consoleErrorCount: consoleErrors.length,
    pageErrors: pageErrors.slice(0, 10), pageErrorCount: pageErrors.length,
    networkErrors: networkErrors.slice(0, 20), networkErrorCount: networkErrors.length,
    net4xx5xx: networkErrors.filter(n => n.status === 401 || n.status === 403 || n.status === 500 || n.status === 502 || n.status === 503),
  };
}

async function checkSeo(browser, path, ua, label) {
  const ctx = await browser.newContext({ userAgent: ua, viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  let data = { path, label, ua: ua.slice(0, 40) };
  try {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    data.status = resp ? resp.status() : null;
    await page.waitForTimeout(3500);
    data = { ...data, ...await page.evaluate(() => {
      const g = (sel, attr) => { const el = document.querySelector(sel); return el ? (attr ? el.getAttribute(attr) : el.textContent) : null; };
      return {
        title: document.title || null,
        description: g('meta[name="description"]', "content"),
        canonical: g('link[rel="canonical"]', "href"),
        ogTitle: g('meta[property="og:title"]', "content"),
        ogDesc: g('meta[property="og:description"]', "content"),
        h1: g("h1"),
        ldjsonCount: document.querySelectorAll('script[type="application/ld+json"]').length,
        robotsMeta: g('meta[name="robots"]', "content"),
      };
    }) };
  } catch (e) { data.err = String(e.message || e).slice(0, 200); }
  await ctx.close();
  return data;
}

async function main() {
  const browser = await chromium.launch();
  const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

  // 1) PAGE CHECKS
  for (const pg of PAGES) {
    console.error("PAGE", pg.name);
    result.pageChecks.push(await checkPage(browser, pg));
  }

  // 2) SEO — Googlebot UA, distinct title/desc/canonical across listing + 2 categories + home
  console.error("SEO");
  result.seo.push(await checkSeo(browser, "/", GOOGLEBOT, "home"));
  result.seo.push(await checkSeo(browser, `/listing/${LISTING_ID}`, GOOGLEBOT, "listing"));
  result.seo.push(await checkSeo(browser, "/kategori/emlak", GOOGLEBOT, "kategori-emlak"));
  result.seo.push(await checkSeo(browser, "/kategori/vasita", GOOGLEBOT, "kategori-vasita"));
  result.seo.push(await checkSeo(browser, "/explore", GOOGLEBOT, "explore"));

  // 3) sitemap + robots (raw fetch)
  console.error("SITEMAP/ROBOTS");
  try {
    const r = await fetch(`${BASE}/sitemap.xml`);
    const t = await r.text();
    const locs = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    result.sitemap = { status: r.status, contentType: r.headers.get("content-type"), urlCount: locs.length, wellFormed: t.trim().startsWith("<?xml") || t.trim().startsWith("<urlset") || t.includes("<urlset"), sample: locs.slice(0, 5) };
  } catch (e) { result.sitemap = { err: String(e.message) }; }
  try {
    const r = await fetch(`${BASE}/robots.txt`);
    const t = await r.text();
    result.robots = { status: r.status, contentType: r.headers.get("content-type"), hasSitemap: /Sitemap:/i.test(t), hasUserAgent: /User-agent:/i.test(t), body: t.slice(0, 500) };
  } catch (e) { result.robots = { err: String(e.message) }; }

  // 4) 404
  console.error("404");
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    try {
      const resp = await page.goto(`${BASE}/xyzabc-nonexistent-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(4000);
      const bodyText = await page.evaluate(() => document.body.innerText);
      result.notFound = {
        httpStatus: resp ? resp.status() : null,
        hasNotFoundContent: /bulunamad|404|sayfa yok|not found|not-found/i.test(bodyText),
        bodySnippet: bodyText.slice(0, 200),
      };
    } catch (e) { result.notFound = { err: String(e.message).slice(0, 200) }; }
    await ctx.close();
  }

  // 5) BROKEN LINKS — collect <a href> from home, sample-fetch
  console.error("BROKEN LINKS");
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    let links = [];
    try {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch {}
    await page.waitForTimeout(5000);
    try {
      links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map(a => a.getAttribute("href")).filter(Boolean));
    } catch {}
    await ctx.close();
    const internal = [...new Set(links.filter(h => h.startsWith("/") || h.startsWith(BASE)).map(h => h.startsWith("http") ? h : BASE + h))].filter(h => !h.includes("#"));
    // sample up to 25
    const sample = internal.slice(0, 25);
    const linkResults = [];
    for (const u of sample) {
      try {
        const r = await fetch(u, { method: "GET", redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
        linkResults.push({ url: u.slice(0, 120), status: r.status });
      } catch (e) { linkResults.push({ url: u.slice(0, 120), status: "FETCH_ERR", err: String(e.message).slice(0, 80) }); }
    }
    result.brokenLinks = { totalHrefFound: links.length, uniqueInternal: internal.length, sampled: sample.length, broken: linkResults.filter(l => l.status === "FETCH_ERR" || (typeof l.status === "number" && l.status >= 400)), allSampled: linkResults };
  }

  // 6) RESPONSIVE — 1366/768/390 horizontal overflow
  console.error("RESPONSIVE");
  const RESP_PAGES = ["/", "/explore", "/kategori/emlak", `/listing/${LISTING_ID}`];
  const VIEWPORTS = [{ w: 1366, h: 768 }, { w: 768, h: 1024 }, { w: 390, h: 844 }];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.w === 390, deviceScaleFactor: vp.w === 390 ? 2 : 1, userAgent: vp.w === 390 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" : undefined });
    for (const path of RESP_PAGES) {
      const page = await ctx.newPage();
      try {
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(4500);
        const m = await page.evaluate(() => ({ scrollWidth: document.body.scrollWidth, innerWidth: window.innerWidth, docScroll: document.documentElement.scrollWidth }));
        result.responsive.push({ viewport: `${vp.w}x${vp.h}`, path, scrollWidth: m.scrollWidth, innerWidth: m.innerWidth, docScrollWidth: m.docScroll, horizontalOverflow: m.scrollWidth > m.innerWidth + 2 || m.docScroll > m.innerWidth + 2, overflowPx: Math.max(m.scrollWidth, m.docScroll) - m.innerWidth });
      } catch (e) { result.responsive.push({ viewport: `${vp.w}x${vp.h}`, path, err: String(e.message).slice(0, 120) }); }
      await page.close();
    }
    await ctx.close();
  }

  // 7) WEB VITALS — LCP + CLS approx via PerformanceObserver
  console.error("WEB VITALS");
  const VITAL_PAGES = ["/", "/explore", "/kategori/emlak"];
  for (const path of VITAL_PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    try {
      await page.addInitScript(() => {
        window.__lcp = 0; window.__cls = 0;
        try {
          new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (!e.hadRecentInput) window.__cls += e.value; } }).observe({ type: "layout-shift", buffered: true });
        } catch {}
      });
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(6500);
      const v = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] || {};
        const fcp = (performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime || null;
        return { lcp: window.__lcp || null, cls: Number((window.__cls || 0).toFixed(4)), fcp, domContentLoaded: nav.domContentLoadedEventEnd || null, loadEvent: nav.loadEventEnd || null };
      });
      result.webVitals.push({ path, ...v });
    } catch (e) { result.webVitals.push({ path, err: String(e.message).slice(0, 120) }); }
    await ctx.close();
  }

  await browser.close();
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.error("DONE ->", OUT);
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
