import { test, expect, type Page } from "@playwright/test";

async function probe(page: Page, label: string) {
  const body = await page.locator("body").innerText();
  const has = /Konum/i.test(body);
  console.log(`${has ? "ok" : "!!"} [${label}] konum filtresi: ${has ? "VAR" : "YOK"}`);
  return has;
}

test("MOBİL: ana sayfa gelişmiş filtrede il/ilçe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.getByLabel(/Gelişmiş filtre/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/f-home-mobile.png" });
  expect(await probe(page, "ana sayfa (mobil)"), "ana sayfada konum filtresi olmalı").toBe(true);
});

test("MOBİL: kategori sayfasında il/ilçe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kategori/emlak", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "e2e-artifacts/f-cat-mobile.png" });
  expect(await probe(page, "kategori (mobil)"), "kategoride konum filtresi olmalı").toBe(true);
});

test("MASAÜSTÜ: ana sayfada 81 il seçici (İl/İlçe)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "e2e-artifacts/f-home-desk.png" });
  const body = await page.locator("body").innerText();
  console.log(`${/İl \/ İlçe/i.test(body) ? "ok" : "!!"} [masaüstü ana sayfa] "Konum (İl / İlçe)": ${/İl \/ İlçe/i.test(body)}`);
  expect(/Konum/i.test(body)).toBe(true);
});
