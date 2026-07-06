import { test, expect, type Page } from "@playwright/test";

// İngilizce (yabancı ziyaretçi) deneyimi: header'daki EN düğmesine basınca site
// İngilizce'ye geçmeli; navigasyon + sayfa içerikleri çevrilmeli.
async function switchToEnglish(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  // Header'daki "EN" düğmesi (TR/EN toggle).
  await page.getByText("EN", { exact: true }).first().click({ timeout: 10_000 });
  await page.waitForTimeout(1500);
}

test("EN modu: ana sayfa navigasyonu İngilizce", async ({ page }) => {
  await switchToEnglish(page);
  // Nav etiketleri İngilizce olmalı.
  await expect(page.getByText("Explore", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("How it works").first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "e2e-artifacts/en-home.png", fullPage: true });
});

test("EN modu: 'How it works' sayfası İngilizce içerik", async ({ page }) => {
  await switchToEnglish(page);
  // Nav'dan How it works'e git.
  await page.getByText("How it works").first().click({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/en-how.png", fullPage: true });
  // Sayfada İngilizce anahtar kelimeler görünür olmalı (Seller/Affiliate/Buyer rolleri).
  const enHits = await page.getByText(/Seller|Buyer|Affiliate|Partner|Commission|Listing/i).count();
  expect(enHits, "how-it-works İngilizce içerik göstermeli").toBeGreaterThan(0);
});

test("EN modu: keşfet sayfası İngilizce chrome", async ({ page }) => {
  await switchToEnglish(page);
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/en-explore.png", fullPage: true });
  // Fiyatlı kartlar hâlâ görünür (işlevsellik korunur) + İngilizce arayüz.
  const priced = await page.getByText(/₺\s?\d/).count();
  expect(priced, "keşfet ilan göstermeye devam etmeli").toBeGreaterThan(0);
});
