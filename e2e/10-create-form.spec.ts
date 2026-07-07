import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

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

// KANIT: kategori seçince kategoriye ÖZEL form açılıyor mu?
test("İlan ver: Otomobil seçince araç formu (Yıl/KM/Yakıt/Vites) açılır", async ({ page }) => {
  const email = uniqueEmail("createform");
  await createConfirmedUser(email, PW, "E2E Create Form");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e-artifacts/create-1-picker.png", fullPage: true });

  // PICKER arama kutusu (header'daki global arama DEĞİL): placeholder "Ne satıyorsun?"
  const search = page.getByPlaceholder(/ne satıyorsun/i).first();
  await search.fill("otomobil");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/create-2-suggest.png", fullPage: true });
  // İlk öneri satırına tıkla (Vasıta › Otomobil …) → forma finalize eder.
  await page.getByText(/Otomobil/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/create-3-form.png", fullPage: true });

  // Araç formunun ALANLARI görünmeli.
  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  const carFields = ["yıl", "kilometre", "yakıt", "vites"].filter((f) => bodyText.includes(f));
  expect(carFields.length, `Araç formu alanları görünmeli (bulunan: ${carFields.join(",")})`).toBeGreaterThanOrEqual(2);
});

// KANIT: Emlak/Konut seçince emlak formu (m²/oda/ısıtma) açılır.
test("İlan ver: Konut seçince emlak formu (m²/oda/ısıtma) açılır", async ({ page }) => {
  const email = uniqueEmail("createform2");
  await createConfirmedUser(email, PW, "E2E Create Form 2");
  await login(page, email);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const search = page.getByPlaceholder(/kategori|ara/i).first();
  await search.fill("satılık daire");
  await page.waitForTimeout(1500);
  await page.getByText(/Daire|Konut/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/create-4-emlak.png", fullPage: true });
  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  const fields = ["m²", "oda", "ısıtma", "aidat", "kat"].filter((f) => bodyText.includes(f));
  expect(fields.length, `Emlak formu alanları görünmeli (bulunan: ${fields.join(",")})`).toBeGreaterThanOrEqual(2);
});
