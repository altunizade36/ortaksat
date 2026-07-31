import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, seedListing, seedSale } from "./helpers/supabase-admin";

/**
 * ORTAK PANELİ güçlendirme: "Kazançlarım" sekmesi artık üstte bir KAZANÇ ÖZETİ gösterir
 * (Toplam · Bekleyen · Ödenen) — ortağın parası tek bakışta; eskiden yalnız satış listesiydi.
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

test("Ortak paneli Kazançlarım: üstte Toplam/Bekleyen/Ödenen özet şeridi", async ({ page }) => {
  const sellerId = await createConfirmedUser(uniqueEmail("pearnsel"), PW, "E2E P Seller");
  const partnerEmail = uniqueEmail("pearn");
  const partnerId = await createConfirmedUser(partnerEmail, PW, "E2E P Partner");
  const listingId = await seedListing(sellerId, "E2E Ortak Kazanc Urunu");
  await seedSale(sellerId, partnerId, listingId); // partnership + order + commission (approved, ₺384)

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, partnerEmail);
  await page.goto("/(tabs)/partner?tab=earning", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  const body = await page.locator("body").innerText();
  expect(body, "Toplam kazanç özeti").toContain("Toplam kazanç");
  expect(body, "Bekleyen özeti").toContain("Bekleyen");
  expect(body, "Ödenen özeti").toContain("Ödenen");
  await page.screenshot({ path: "e2e-artifacts/partner-earnings.png", fullPage: true });
});
