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
test("EMLAK yeni yapı derin drill", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const email = uniqueEmail("emlakderin");
  await createConfirmedUser(email, PW, "E2E Emlak");
  await login(page, email);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  for (const s of ["Emlak", "Konut", "Turistik Günlük Kiralık", "Daire", "2+1"]) {
    await page.getByText(s, { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1200);
  const body = (await page.locator("body").innerText()).toLowerCase();
  const reachedForm = /gecelik|ilan başlığı|başlık/.test(body);
  console.log("Turistik Günlük Kiralık > Daire > 2+1 forma ulaştı:", reachedForm);
  expect(reachedForm).toBeTruthy();
  await ctx.close();
});
