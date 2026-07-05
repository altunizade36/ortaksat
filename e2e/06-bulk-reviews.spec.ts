import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, runSql, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(4000);
}

test("TOPLU İLAN: satıcı toplu ekleme ile birden çok ilan yayınlar", async ({ page }) => {
  const email = uniqueEmail("bulk");
  const sellerId = await createConfirmedUser(email, PW, "E2E Toplu Satici");
  await login(page, email);
  await page.goto("/seller", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  // "Toplu ilan ekle" butonuna bas.
  await page.getByText(/Toplu ilan ekle/i).first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/BULK-modal.png", fullPage: true });
  // Satırları yapıştır (Başlık | Fiyat | Komisyon% | Kategori).
  const rows = [
    "E2E Toplu Koltuk Bir [E2E-TEST] | 5000 | 10 | Ev & Yaşam",
    "E2E Toplu Kulaklik Iki [E2E-TEST] | 1899 | 12 | Elektronik",
    "E2E Toplu Canta Uc [E2E-TEST] | 2499 | 15 | Moda"
  ].join("\n");
  const box = page.locator("textarea").last();
  await box.fill(rows);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/BULK-preview.png", fullPage: true });
  // "N ilanı yayınla" butonuna bas.
  await page.getByText(/ilanı yayınla/i).first().click({ timeout: 8000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e-artifacts/BULK-done.png", fullPage: true });

  const res = await runSql<Array<{ n: number }>>(
    `select count(*) as n from listings where owner_id='${sellerId}' and title like '%[E2E-TEST]%';`
  );
  expect(Number(res[0].n), "toplu eklenen ilanlar DB'de olmalı").toBeGreaterThanOrEqual(3);
});
