import { test } from "@playwright/test";

test("blog-mobile-390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("https://ortaksat.com/blog", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const badge = await page.getByText("Öne Çıkan Yazı").first().boundingBox().catch(() => null);
  console.log(`[mobile] rozetTop=${badge?.y ?? "GORUNMEZ"}`);
  await page.screenshot({ path: "e2e-artifacts/blogfix-mobile.png", fullPage: false });
});

test("blog-desktop-1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("https://ortaksat.com/blog", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const badge = await page.getByText("Öne Çıkan Yazı").first().boundingBox().catch(() => null);
  console.log(`[desktop] rozetTop=${badge?.y ?? "GORUNMEZ"}`);
  await page.screenshot({ path: "e2e-artifacts/blogfix-desktop.png", fullPage: false });
});
