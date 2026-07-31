import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, seedListing, runSql } from "./helpers/supabase-admin";

/**
 * ORTAK PANELİ "Ortak ürünlerim" (paylaşım linkleri) güçlendirme: her link altında
 * PERFORMANS (tıklama · talep) görünür — ortak hangi linkinin çalıştığını görür.
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

test("Ortak paneli linkler: her paylaşım linkinde tıklama · talep performansı", async ({ page }) => {
  const sellerId = await createConfirmedUser(uniqueEmail("plinksel"), PW, "E2E PL Seller");
  const partnerEmail = uniqueEmail("plink");
  const partnerId = await createConfirmedUser(partnerEmail, PW, "E2E PL Partner");
  const listingId = await seedListing(sellerId, "E2E Link Perf Urunu");
  const ref = `e2e${Date.now().toString(36)}`;
  const pr = await runSql<Array<{ id: string }>>(
    `insert into partnerships (id, listing_id, partner_id, ref_code, status) values (gen_random_uuid(), '${listingId}','${partnerId}','${ref}','active') returning id;`
  );
  const partnershipId = pr[0].id;

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, partnerEmail);
  await page.goto("/(tabs)/partner?tab=links", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  const body = await page.locator("body").innerText();
  expect(body, "aktif ortaklığın paylaşım satırı görünmeli").toContain("E2E Link Perf Urunu");
  expect(body, "link performansı: tıklama").toContain("tıklama");
  expect(body, "link performansı: talep").toContain("talep");
  await page.screenshot({ path: "e2e-artifacts/partner-link-perf.png", fullPage: true });
});
