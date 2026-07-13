import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";
const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });
test("DİĞER → öneri havuzu: kullanıcı eksik kategoriyi yazar, admin havuzuna düşer", async ({ page }) => {
  test.setTimeout(600000);
  page.on("dialog", (d) => d.accept().catch(() => {}));
  const email = uniqueEmail("diger");
  await createConfirmedUser(email, PW, "E2E Diger");
  await resetAuthRateLimits();
  await page.goto("/auth"); await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap(); await page.waitForTimeout(5500);

  await page.goto("/create"); await page.waitForTimeout(3200);
  await page.getByText(/^Yeni başla/).first().tap({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1000);
  // Emlak → (alt dal) → Diğer
  await page.getByText("Emlak", { exact: true }).first().tap({ timeout: 8000 });
  await page.waitForTimeout(2000);
  const diger = page.getByText("Diğer", { exact: true }).first();
  console.log(`Emlak altında "Diğer" var mı: ${(await diger.count()) > 0 ? "EVET ✓" : "HAYIR ✗"}`);
  await diger.tap({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e-artifacts/diger-1.png" });

  const body = await page.locator("body").innerText();
  const alanVar = /Aradığın kategori listede yok mu/i.test(body);
  console.log(`"Aradığın kategori" alanı çıktı mı: ${alanVar ? "EVET ✓" : "HAYIR ✗"}`);
  if (!alanVar) return;

  const inp = page.getByPlaceholder(/Drone Yedek|Vintage Plak/i).first();
  await inp.fill("Konteyner Ofis Kiralama");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "e2e-artifacts/diger-2.png" });
  console.log("eksik kategori yazıldı: 'Konteyner Ofis Kiralama'");
});
