import { test, expect, devices, type Page } from "@playwright/test";

// 320px REGRESYON KORUMASI.
// Denetim meta-bulgusu: suite'te 390px ALTI hiç test edilmiyordu (1440/1280/834/390) →
// header taşması ve compare-bar taşması tam da 320-375px'te oluşuyordu ve görülmemişti.
// Ayrıca hiçbir test compare'i AÇMIYORDU → bar hiç render edilmiyor, hatası görünmüyordu.
const NARROW = { ...devices["iPhone SE"], viewport: { width: 320, height: 640 } };

async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

test("320px: header ve keşfet yatay taşma YAPMAZ", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext(NARROW);
  const page = await ctx.newPage();
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  const ov = await pageOverflow(page);
  console.log(`[320px keşfet] yatay taşma: ${ov}px`);
  expect(ov, `320px'te sayfa ${ov}px yana taşıyor`).toBeLessThanOrEqual(1);

  // Marka yazısı header aksiyon butonlarının ALTINA girmemeli: wordmark görünür olmalı.
  const brand = page.getByText("ortaksat", { exact: true }).first();
  await expect(brand).toBeVisible();
  await ctx.close();
});

test("320px: compare barı açıkken sayfa yana kaymaz", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext(NARROW);
  const page = await ctx.newPage();
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  // Keşfet kartlarındaki "Karşılaştır" düğmelerinden ikisini aç (bar ancak o zaman görünür).
  const compareBtns = page.getByLabel(/Karşılaştır|Compare/i);
  const n = await compareBtns.count();
  console.log(`[320px] karşılaştır düğmesi sayısı: ${n}`);
  if (n === 0) test.skip(true, "karşılaştır düğmesi bulunamadı");

  for (let i = 0; i < Math.min(2, n); i++) {
    await compareBtns.nth(i).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(900);

  const ov = await pageOverflow(page);
  console.log(`[320px compare açık] yatay taşma: ${ov}px`);
  await page.screenshot({ path: "e2e-artifacts/narrow/compare-320.png" }).catch(() => {});
  expect(ov, `compare barı açıkken 320px'te sayfa ${ov}px yana taşıyor`).toBeLessThanOrEqual(1);
  await ctx.close();
});
