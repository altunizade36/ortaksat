import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

/**
 * HESABIM güçlendirme doğrulaması:
 *  - Profil hub'ında "Kazançlarım" girişi (masaüstü + mobil) — earnings sayfası artık
 *    hub'dan erişilir (eskiden yalnız header menüde vardı).
 *  - Masaüstü stat kartı tıklanınca /earnings'e gider (eskiden ölü statik kart).
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

test("Profil hub: Kazançlarım girişi (masaüstü+mobil) + tıklanabilir stat kartı → /earnings", async ({ page }) => {
  const email = uniqueEmail("hesap");
  await createConfirmedUser(email, PW, "E2E Hesap");
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, email);

  // --- Masaüstü ---
  await page.goto("/(tabs)/profile", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  let body = await page.locator("body").innerText();
  expect(body, "masaüstü hub'da Kazançlarım girişi").toContain("Kazançlarım");
  expect(body, "masaüstü stat kartı 'Kayıtlı komisyon'").toContain("Kayıtlı komisyon");
  expect(body, "masaüstü Mağazanı paylaş kartı").toContain("Mağazanı paylaş");
  expect(body, "masaüstü gerçek paylaş aksiyonu").toContain("Bağlantıyı paylaş");
  await page.screenshot({ path: "e2e-artifacts/hesabim-desktop.png", fullPage: true });

  // Stat kartına tıkla → /earnings'e gitmeli.
  await page.getByText("Kayıtlı komisyon", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  expect(page.url(), "stat kartı /earnings'e götürmeli").toContain("earnings");

  // --- Mobil ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/(tabs)/profile", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  body = await page.locator("body").innerText();
  expect(body, "mobil hub'da Kazançlarım girişi").toContain("Kazançlarım");
  expect(body, "mobil Mağazanı paylaş kartı (masaüstü paritesi)").toContain("Mağazanı paylaş");
  expect(body, "mobil gerçek paylaş aksiyonu").toContain("Bağlantıyı paylaş");
  await page.screenshot({ path: "e2e-artifacts/hesabim-mobile.png", fullPage: true });
});
