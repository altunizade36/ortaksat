import { test, devices } from "@playwright/test";
test.use({ ...devices["iPhone 13"] });
test("estetik: kategori + kartlar", async ({ page }) => {
  await page.goto("/kategori/emlak", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "e2e-artifacts/aes-kategori-top.png" });
  await page.evaluate(() => {
    const d = Array.from(document.querySelectorAll<HTMLElement>("div"));
    const sc = d.filter(e => { const s = getComputedStyle(e); return (s.overflowY==="auto"||s.overflowY==="scroll") && e.scrollHeight>e.clientHeight+20; }).sort((a,b)=>b.scrollHeight-a.scrollHeight)[0];
    if (sc) sc.scrollTop = 700; else window.scrollTo(0,700);
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "e2e-artifacts/aes-kategori-cards.png" });
});
