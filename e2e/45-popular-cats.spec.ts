import { test, devices, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";
const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });
test("Popüler kategoriler çipi görünüyor ve tek dokunuşla forma götürüyor", async ({ page }) => {
  const email = uniqueEmail("popcat");
  await createConfirmedUser(email, PW, "E2E PopCat");
  await resetAuthRateLimits();
  await page.goto("/auth"); await page.waitForTimeout(1800);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap(); await page.waitForTimeout(5500);
  await page.goto("/create"); await page.waitForTimeout(3500);
  const body = await page.locator("body").innerText();
  const has = /Popüler kategoriler/.test(body);
  console.log(`"Popüler kategoriler" görünüyor mu? ${has ? "EVET ✓" : "HAYIR ✗"}`);
  await page.screenshot({ path: "e2e-artifacts/popular-cats.png" });
  expect(has).toBe(true);
  // ilk popüler çipe dokun → forma
  const chip = page.getByRole("button", { name: /›/ }).first();
  await chip.tap({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const inForm = /İlan başlığı/.test(await page.locator("body").innerText());
  console.log(`Çipe dokununca forma gitti mi? ${inForm ? "EVET ✓" : "HAYIR ✗"}`);
  expect(inForm).toBe(true);
});
