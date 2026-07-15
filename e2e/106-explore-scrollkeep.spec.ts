import { test, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/explore-scrollkeep";

async function scrollY(page: Page): Promise<number> {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("div")) as HTMLElement[];
    let best = 0;
    for (const el of all) {
      const st = getComputedStyle(el);
      if ((st.overflowY === "scroll" || st.overflowY === "auto") && el.scrollHeight > el.clientHeight + 100) {
        if (el.scrollTop > best) best = el.scrollTop;
      }
    }
    return Math.max(best, window.scrollY || 0);
  });
}

async function scrollDown(page: Page, dy: number) {
  await page.evaluate((delta) => {
    const all = Array.from(document.querySelectorAll("div")) as HTMLElement[];
    const sv = all.find((el) => (getComputedStyle(el).overflowY === "scroll" || getComputedStyle(el).overflowY === "auto") && el.scrollHeight > el.clientHeight + 100);
    if (sv) sv.scrollTop += delta;
    window.scrollBy(0, delta);
  }, dy);
}

test("KEŞFET: ilana girip geri dönünce kaydırma konumu korunmalı (mobil)", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.text().includes("EXPLORE-")) console.log("  APP:", m.text()); });
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  // Aşağı kaydır
  for (let i = 0; i < 5; i++) { await scrollDown(page, 1200); await page.waitForTimeout(500); }
  const before = await scrollY(page);
  await page.screenshot({ path: `${OUT}/1-kaydirildi.png` }).catch(() => {});
  console.log(`kaydırma konumu (ilana girmeden): ${before}px`);

  // Bir ilana gir (görünen bir kart)
  const card = page.getByText(/Jet Ski|Villa|Pixel|Samsung|Piyano|Matkap|Bot|Dükkan|iPhone|Sony|Gitar/).first();
  await card.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const onListing = page.url().includes("/listing/");
  console.log(`ilana gitti: ${onListing}`);

  // GERİ dön
  await page.goBack().catch(() => {});
  await page.waitForTimeout(3500);
  const after = await scrollY(page);
  await page.screenshot({ path: `${OUT}/2-geri-donunce.png` }).catch(() => {});
  console.log(`kaydırma konumu (geri dönünce): ${after}px | korundu mu: ${Math.abs(after - before) < 300}`);
  await ctx.close();
});
