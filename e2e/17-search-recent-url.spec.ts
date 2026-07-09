import { test, expect } from "@playwright/test";

/**
 * Son aramalar + filtre→URL senkronu doğrulaması.
 */

test("Filtre→URL: derin-link param'ları uygulanır ve URL'de korunur", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/explore?price=1000-5000&sort=new&verified=1", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "e2e-artifacts/url-sync.png", fullPage: true });
  // Senkron effect param'ları geri yazar → URL'de kalır (state param'dan init edildi).
  const url = page.url();
  expect(url, "price param URL'de kalmalı").toContain("price=1000-5000");
  expect(url, "sort param URL'de kalmalı").toContain("sort=new");
  // Masaüstü toolbar seçili sıralamayı gösterir ("En yeni").
  const body = await page.locator("body").innerText();
  expect(body, "seçili sıralama uygulanmış görünmeli").toContain("En yeni");
});

test("Son aramalar: gönderilen sorgu, boş kutuya odakta chip olarak görünür", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const marker = `koltuktest${Date.now()}`;
  const search = page.locator("input[type='text'], input:not([type])").first();
  await search.fill(marker);
  await search.press("Enter");
  await page.waitForTimeout(3000);
  // Temiz sayfaya git (arama kutusu boş) → odaklan → son aramalar görünmeli.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const search2 = page.locator("input[type='text'], input:not([type])").first();
  await search2.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e-artifacts/recent-searches.png", fullPage: true });
  const body = await page.locator("body").innerText();
  expect(body, "'Son aramalar' başlığı görünmeli").toContain("Son aramalar");
  expect(body, "gönderilen sorgu son aramalarda görünmeli").toContain(marker);
});
