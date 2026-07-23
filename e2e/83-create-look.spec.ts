import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/create-look";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  const eb = page.getByText(/E-posta ile giriş yap/i).first();
  if (await eb.count().then((c) => c > 0).catch(() => false)) await eb.click();
  else await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(5500);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {});
}

test("KATEGORİ GÖRÜNÜM (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const email = uniqueEmail("looku");
  await createConfirmedUser(email, PW, "E2E Look");
  await login(page, email);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await shot(page, "d1-kategori-baslangic");
  // Emlak seç
  await page.getByText("Emlak", { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "d2-emlak-acildi");

  // SÜTUN NAVİGASYONU (yeniden yazıldı): ana → alt → yaprak → form adımına geçmeli.
  await page.getByText("Konut", { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.getByText("Satılık", { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  // Daire'nin de çocukları var (oda sayısı: 1+0, 1+1, 2+1…) → Daire YAPRAK DEĞİL, bir seviye daha in.
  // NOT: regex "Konut" KIRILIMDAKİ (breadcrumb) linki eşleştirip geri sıçratıyordu → kesin metin kullan.
  await page.getByText("Daire", { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.getByText("2+1", { exact: true }).first().click().catch(() => {}); // gerçek yaprak → forma geç
  await page.waitForTimeout(2500);
  await shot(page, "d3-form-adimi");

  // Kategori seçilince İLAN BİLGİLERİ adımının içeriği (başlık alanı) görünmeli.
  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  const advanced = /ilan başlığı|başlık|açıklama|fiyat/.test(bodyText);
  console.log(`sütun-nav sonrası forma geçti mi: ${advanced}`);
  expect(advanced, "ana→alt→yaprak seçimi form adımına geçmeli").toBeTruthy();

  await ctx.close();
});

test("KATEGORİ GÖRÜNÜM (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const email = uniqueEmail("lookm");
  await createConfirmedUser(email, PW, "E2E LookM");
  await login(page, email);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await shot(page, "m1-kategori-baslangic");
  await ctx.close();
});
