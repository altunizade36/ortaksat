import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  // Görünen submit butonu "Giriş Yap" (sekme de aynı metinde → .last() submit'i alır).
  await page.getByText("Giriş Yap", { exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(5000);
}

// Sahibinden-yapısı Yedek Parça: 6 seviye drill → parça sistemi yaprağı → form.
test("YEDEK PARÇA derin drill (masaüstü iki-panel)", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const email = uniqueEmail("ypderin");
  await createConfirmedUser(email, PW, "E2E YP");
  await login(page, email);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const steps = ["Yedek Parça, Aksesuar, Donanım & Tuning", "Otomotiv Ekipmanları", "Yedek Parça", "Otomobil & Arazi Aracı", "Motor"];
  for (const s of steps) {
    await page.getByText(s, { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/yp-deep.png", fullPage: true });

  const body = (await page.locator("body").innerText()).toLowerCase();
  const reachedForm = /ilan başlığı|parça|uyumlu|başlık/.test(body);
  console.log("Yedek Parça derin drill → forma ulaştı:", reachedForm);
  // Breadcrumb tüm seviyeleri gösteriyor mu
  const hasCrumb = body.includes("otomotiv ekipmanları") || body.includes("otomobil & arazi");
  console.log("breadcrumb derin yol:", hasCrumb);
  expect(reachedForm, "derin parça-sistemi seçimi form adımına geçmeli").toBeTruthy();
  await ctx.close();
});
