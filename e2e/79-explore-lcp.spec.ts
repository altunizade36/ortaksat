import { test, devices } from "@playwright/test";

/**
 * KEŞFET LCP TEŞHİSİ: masaüstünde 2.3-3.1sn. NE geciktiriyor?
 * LCP öğesini, boyutunu, kaynağını ve tüm görsel isteklerinin zamanlamasını çıkarır.
 */
async function probe(page: import("@playwright/test").Page, tag: string) {
  const imgs: Array<{ url: string; ms: number; kb: number }> = [];
  const t0 = Date.now();
  page.on("response", async (r) => {
    const ct = r.headers()["content-type"] ?? "";
    if (!/image|video/.test(ct)) return;
    const len = Number(r.headers()["content-length"] ?? 0);
    imgs.push({ url: r.url().slice(-60), ms: Date.now() - t0, kb: Math.round(len / 1024) });
  });

  await page.addInitScript(() => {
    (window as unknown as { __lcp: unknown }).__lcp = null;
    new PerformanceObserver((list) => {
      const e = list.getEntries().at(-1) as PerformanceEntry & { size?: number; url?: string; element?: Element };
      (window as unknown as { __lcp: unknown }).__lcp = {
        time: Math.round(e.startTime),
        size: e.size,
        url: e.url || "",
        tag: e.element?.tagName ?? "",
        cls: (e.element?.className ?? "").toString().slice(0, 40),
        txt: (e.element as HTMLElement | undefined)?.innerText?.slice(0, 60) ?? ""
      };
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.goto("/explore", { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const lcp = await page.evaluate(() => (window as unknown as { __lcp: unknown }).__lcp);
  console.log(`\n[${tag}] LCP:`, JSON.stringify(lcp));

  const heavy = imgs.sort((a, b) => b.kb - a.kb).slice(0, 8);
  console.log(`[${tag}] toplam görsel isteği: ${imgs.length}`);
  console.log(`[${tag}] EN AĞIR 8:`);
  for (const i of heavy) console.log(`   ${String(i.kb).padStart(5)}kB  @${String(i.ms).padStart(5)}ms  ${i.url}`);
  const late = imgs.filter((i) => i.ms > 1500);
  console.log(`[${tag}] 1.5sn'den GEÇ gelen görsel: ${late.length}`);
}

test("KEŞFET LCP: masaüstü", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await probe(page, "MASAÜSTÜ");
  await ctx.close();
});

test("KEŞFET LCP: mobil", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await probe(page, "MOBİL");
  await ctx.close();
});
