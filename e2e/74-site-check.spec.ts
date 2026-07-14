import { test, devices, chromium } from "@playwright/test";

const BASE = "https://www.ortaksat.com";
const PAGES: Array<[string, string]> = [
  ["Ana sayfa", "/"],
  ["Keşfet", "/explore"],
  ["Kategori", "/kategori/emlak"]
];

async function measure(page: any, path: string) {
  const t0 = Date.now();
  await page.goto(BASE + path, { waitUntil: "load", timeout: 60000 });
  const loadMs = Date.now() - t0;
  const lcp = await page.evaluate(() => new Promise<number>((res) => {
    let v = 0;
    try {
      new PerformanceObserver((l: any) => { for (const e of l.getEntries()) v = e.renderTime || e.loadTime || e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch { /* */ }
    setTimeout(() => res(Math.round(v)), 2500);
  }));
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return { ttfb: Math.round(n.responseStart), load: Math.round(n.loadEventEnd) };
  });
  return { loadMs, lcp, ...nav };
}

test("SİTE KONTROL: hız (mobil + masaüstü) + mobil uyum", async () => {
  test.setTimeout(600_000);
  const b = await chromium.launch();

  for (const [label, ctxOpts] of [
    ["MOBİL    ", { ...devices["iPhone 13"] }],
    ["MASAÜSTÜ ", { viewport: { width: 1440, height: 900 } }]
  ] as Array<[string, any]>) {
    const ctx = await b.newContext(ctxOpts);
    const page = await ctx.newPage();
    if (label.startsWith("MOBİL")) {
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      const vp = await page.locator('meta[name="viewport"]').getAttribute("content").catch(() => null);
      console.log(`\n[MOBİL] viewport meta: ${vp ?? "YOK !!"}`);
    }
    for (const [name, path] of PAGES) {
      const m = await measure(page, path);
      const verdict = m.lcp === 0 ? "(LCP yok)" : m.lcp < 2500 ? "✓ HIZLI" : m.lcp < 3000 ? "✓ 3sn altı" : "!! 3sn ÜSTÜ";
      console.log(`[${label}] ${name.padEnd(10)} TTFB=${String(m.ttfb).padStart(4)}ms  LOAD=${String(m.load).padStart(4)}ms  LCP=${String(m.lcp).padStart(4)}ms  ${verdict}`);
    }
    await ctx.close();
  }
  await b.close();
});
