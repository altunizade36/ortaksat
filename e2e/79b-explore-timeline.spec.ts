import { test } from "@playwright/test";

/**
 * KEŞFET ZAMAN ÇİZELGESİ: görseller 9x küçüldü ama masaüstü LCP hâlâ ~2.8sn.
 * Demek ki darboğaz görsel değil. Kartların ekrana gelmesi için ne bekleniyor?
 * Supabase veri isteklerini ve ilk kartın DOM'a girişini zamanlar.
 */
test("KEŞFET zaman çizelgesi (masaüstü)", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const api: Array<{ ms: number; dur: number; url: string }> = [];

  page.on("requestfinished", async (req) => {
    const u = req.url();
    if (!/supabase\.co|\/rest\/v1\//.test(u)) return;
    const timing = req.timing();
    api.push({
      ms: Date.now() - t0,
      dur: Math.round(timing.responseEnd - timing.requestStart),
      url: u.replace(/^https:\/\/[^/]+\/rest\/v1\//, "").slice(0, 70)
    });
  });

  await page.goto("/explore", { waitUntil: "commit" });

  // İlk ilan kartı görselinin DOM'a girdiği an
  const firstCard = await page
    .waitForFunction(() => {
      const img = document.querySelector('img[src*="/demo/"]');
      return img ? performance.now() : null;
    }, undefined, { timeout: 30000 })
    .then((h) => h.jsonValue())
    .catch(() => null);

  await page.waitForTimeout(3000);

  console.log("\n=== SUPABASE İSTEKLERİ (sırayla) ===");
  for (const a of api.sort((x, y) => x.ms - y.ms)) {
    console.log(`  @${String(a.ms).padStart(5)}ms  (${String(a.dur).padStart(4)}ms sürdü)  ${a.url}`);
  }
  console.log(`\nİLK İLAN KARTI DOM'a girdi: ${firstCard ? Math.round(Number(firstCard)) + "ms" : "GÖRÜNMEDİ"}`);
  console.log(`Toplam Supabase isteği: ${api.length}`);

  await ctx.close();
});
