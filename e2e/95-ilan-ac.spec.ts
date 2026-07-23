import { test, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";
const PW = "GucluSifre123!";
const IDS = ["0bf41c94-9e37-499a-aa84-227da1d3ab5b", "52966281-fc3c-47cf-b2d9-780a9998d5a0"];
const ROUTES = ["/listing/ID", "/(tabs)/seller", "/hesabim", "/profil", "/favoriler", "/mesajlar", "/(tabs)/partner", "/explore", "/create"];
async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(5500);
}
test("GİRİŞLİ: ilan + hesap sekmeleri hata taraması", async ({ page }) => {
  test.setTimeout(300_000);
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e.message).slice(0, 200)));
  const email = uniqueEmail("ilanac");
  await createConfirmedUser(email, PW, "E2E IlanAc");
  await login(page, email);
  const paths = ROUTES.flatMap((r) => r.includes("ID") ? IDS.map((i) => r.replace("ID", i)) : [r]);
  for (const p of paths) {
    errs.length = 0;
    await page.goto(p, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(4000);
    const body = await page.locator("body").innerText().catch(() => "");
    const broken = /bir şeyler ters gitti|something went wrong/i.test(body);
    console.log(`${broken ? "!! BOZUK" : "ok     "} ${p}${errs.length ? "  ERR:" + errs[0].slice(0, 100) : ""}`);
  }
});
