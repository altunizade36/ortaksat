import { test, expect } from "@playwright/test";
test("ilan görselinde ortaksat.com filigranı var", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/listing/0bf41c94-9e37-499a-aa84-227da1d3ab5b", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const n = await page.evaluate(() => (document.body.innerText.match(/ortaksat\.com/g) || []).length);
  console.log("görselde filigran tekrarı:", n);
  expect(n, "filigran görünmeli").toBeGreaterThan(3);
});
