import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

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

/**
 * PROFİL GÜCÜ ETİKET TUTARLILIĞI: doğrulaması OLMAYAN kullanıcı, "Profil gücü" listesinde
 * yapılmamış maddeleri EMİR kipiyle görmeli ("Telefonunu doğrula"), "doğrulandı" DEĞİL.
 */
test("PROFİL GÜCÜ: doğrulanmamışta emir kipi, 'doğrulandı' değil (masaüstü)", async ({ browser }) => {
  test.setTimeout(150_000);
  const email = uniqueEmail("pverify");
  await createConfirmedUser(email, PW, "Doğrulanmamış Kişi");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  await login(page, email);

  for (const path of ["/profile", "/profile-edit"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    const body = await page.locator("body").innerText();
    // Profil gücü paneli bölgesindeki emir-kipi etiketleri olmalı
    expect(body.includes("Telefonunu doğrula"), `${path}: emir kipi 'Telefonunu doğrula' olmalı`).toBeTruthy();
    // "Telefon doğrulandı" (bitmiş) doğrulanmamış kullanıcıda profil-gücü listesinde OLMAMALI.
    // (StatusPill 'Telefon bekliyor' der; 'doğrulandı' yalnız gerçekten doğrulanınca.)
    expect(body.includes("Telefon doğrulandı"), `${path}: doğrulanmamışta 'Telefon doğrulandı' olmamalı`).toBeFalsy();
    console.log(`${path}: emir kipi ✓, yanıltıcı 'doğrulandı' yok ✓`);
  }
  console.log("PROFIL GUCU ETIKET OK");
  await ctx.close();
});
