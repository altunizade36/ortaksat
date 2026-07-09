import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, seedListing, resetAuthRateLimits } from "./helpers/supabase-admin";

/**
 * Part 2 (satıcı/mağaza/toplu) iyileştirmeleri doğrulaması:
 *  - Toplu ilan: CSV şablon indirme butonu + tek toplu giriş (eski modal kaldırıldı).
 *  - Mağaza: 'Numarayı Göster' butonu.
 */

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(4000);
}

test("Toplu ilan: CSV şablon indirme butonu görünür", async ({ page }) => {
  await createConfirmedUser(uniqueEmail("bulk"), PW, "E2E Bulk"); // login e-postasını yakalamak için ayrı
  const email = uniqueEmail("bulk2");
  await createConfirmedUser(email, PW, "E2E Bulk2");
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, email);
  await page.goto("/toplu-ilan", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "e2e-artifacts/bulk-listing.png", fullPage: true });
  const body = await page.locator("body").innerText();
  expect(body, "CSV şablon indirme butonu görünmeli").toContain("Şablonu indir");
  expect(body, "toplu ilan başlığı görünmeli").toMatch(/toplu ilan/i);
});

test("Mağaza: 'Numarayı Göster' butonu görünür", async ({ page }) => {
  // Başka bir satıcının mağazasına git (kendi mağazanda numara-göster çıkmaz).
  const sellerId = await createConfirmedUser(uniqueEmail("stseller"), PW, "E2E Store Satici");
  await seedListing(sellerId, `E2E Mağaza Ürünü`);
  const viewerEmail = uniqueEmail("stviewer");
  await createConfirmedUser(viewerEmail, PW, "E2E Store Viewer");
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, viewerEmail);
  await page.goto(`/store/${sellerId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e-artifacts/store-phone.png", fullPage: true });
  const body = await page.locator("body").innerText();
  expect(body, "'Numarayı Göster' butonu görünmeli").toContain("Numarayı Göster");
});
