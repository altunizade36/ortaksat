import { test, devices } from "@playwright/test";
test.use({ ...devices["iPhone 13"] });
test("kart geometrisi", async ({ page }) => {
  await page.goto("/kategori/emlak", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-vcard]')).slice(0, 4)
      .map((c) => { const b = c.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width) }; });
    return { vw, cards };
  });
  console.log(JSON.stringify(r));
});
