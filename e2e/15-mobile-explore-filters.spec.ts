import { test, expect } from "@playwright/test";

/**
 * Mobil explore parite: mobil filtre panelinde artık il/ilçe (LocationSelector),
 * stok durumu ve onaylı-satıcı filtreleri var (önceden yalnız masaüstü toolbar'da).
 * Masaüstü feed'i etkilenmemeli (kontroller mobil-özel gate'li).
 */

test("Mobil explore filtre paneli: il/ilçe + stok + onaylı satıcı görünür", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  // "Filtre" butonuna dokun → panel açılır.
  await page.getByText("Filtre", { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/mobile-filters.png", fullPage: true });
  const body = await page.locator("body").innerText();
  expect(body, "il/ilçe konum filtresi görünmeli").toContain("Konum (İl / İlçe)");
  expect(body, "stok durumu filtresi görünmeli").toContain("Stok Durumu");
  expect(body, "onaylı satıcı filtresi görünmeli").toContain("Sadece onaylı satıcılar");
});

test("Masaüstü explore feed regresyonsuz (mobil filtreler masaüstünü etkilemez)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const n = await page.getByText(/₺\s?\d/).count();
  console.log("DESK cards=", n);
  expect(n, "masaüstü keşfet kartları render etmeli").toBeGreaterThan(0);
});
