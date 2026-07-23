import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";
const PW = "GucluSifre123!";
async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(5000);
}
test("VASITA Arazi/SUV brand-model drill", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const email = uniqueEmail("vasitaderin");
  await createConfirmedUser(email, PW, "E2E Vasita");
  await login(page, email);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  for (const s of ["Vasıta", "Arazi, SUV & Pickup", "BMW"]) {
    await page.getByText(s, { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  // model seçilebilmeli (bir model veya "Diğer Model" görünmeli)
  const body1 = (await page.locator("body").innerText());
  const hasModel = /Diğer Model|X5|X3|Seri/i.test(body1);
  console.log("Arazi SUV > BMW model seviyesi görünür:", hasModel);
  await page.getByText(/Diğer Model|X5/).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const body2 = (await page.locator("body").innerText()).toLowerCase();
  const reachedForm = /hasar durumu|kasa tipi|ilan başlığı|yakıt/.test(body2);
  console.log("otomobil formuna ulaştı:", reachedForm);
  expect(hasModel || reachedForm).toBeTruthy();
  await ctx.close();
});
