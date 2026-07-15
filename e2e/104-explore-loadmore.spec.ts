import { test, expect, devices, type Page } from "@playwright/test";

/**
 * SONSUZ KAYDIRMA: keşfet aşağı kaydırıldıkça daha çok kart yüklemeli (windowing + load-more).
 * RN-web ScrollView'ı gerçek scroll container; onu doğrudan kaydırıp kart artışını ölçeriz.
 */
async function scrollContainer(page: Page, dy: number) {
  await page.evaluate((delta) => {
    // En büyük dikey-kaydırılabilir öğeyi bul (explore ScrollView)
    const all = Array.from(document.querySelectorAll("div")) as HTMLElement[];
    let best: HTMLElement | null = null;
    for (const el of all) {
      const st = getComputedStyle(el);
      if ((st.overflowY === "scroll" || st.overflowY === "auto") && el.scrollHeight > el.clientHeight + 100) {
        if (!best || el.scrollHeight > best.scrollHeight) best = el;
      }
    }
    const target = best || document.scrollingElement || document.documentElement;
    (target as HTMLElement).scrollTop += delta;
    window.scrollBy(0, delta);
  }, dy);
}

test("KEŞFET sonsuz kaydırma yükle-daha (mobil)", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  const count = () => page.evaluate(() => document.querySelectorAll('img[src*="/demo/"]').length);
  const initial = await count();

  for (let i = 0; i < 8; i++) { await scrollContainer(page, 1400); await page.waitForTimeout(700); }
  const afterScroll = await count();
  console.log(`başlangıç kart:${initial} → kaydırma sonrası:${afterScroll}`);

  expect(afterScroll, `kaydırınca daha çok kart yüklenmeli (${initial}→${afterScroll})`).toBeGreaterThan(initial);
  console.log("SONSUZ KAYDIRMA ÇALIŞIYOR ✓");
  await ctx.close();
});
