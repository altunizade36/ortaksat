import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, seedListing, runSql, resetAuthRateLimits } from "./helpers/supabase-admin";

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

test("Mağaza takip: 'Takip Et' → 'Takiptesin' + DB'de follow kaydı oluşur", async ({ page }) => {
  const sellerId = await createConfirmedUser(uniqueEmail("flwseller"), PW, "E2E Follow Satici");
  await seedListing(sellerId, "E2E Takip Ürünü");
  const viewerEmail = uniqueEmail("flwviewer");
  const viewerId = await createConfirmedUser(viewerEmail, PW, "E2E Follow Viewer");
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, viewerEmail);
  await page.goto(`/store/${sellerId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  // "Takip Et" butonuna bas.
  await page.getByText("Takip Et", { exact: true }).first().click({ timeout: 8000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/store-follow.png", fullPage: true });
  const body = await page.locator("body").innerText();
  expect(body, "buton 'Takiptesin' olmalı").toContain("Takiptesin");
  // DB'de follow kaydı oluşmuş olmalı.
  const rows = await runSql<Array<{ n: number }>>(`select count(*)::int n from follows where follower_id='${viewerId}' and seller_id='${sellerId}';`);
  expect(rows[0]?.n, "DB'de follow kaydı olmalı").toBe(1);
});
