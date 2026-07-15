import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/admin-look";

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

test("ADMIN panel görünüm (masaüstü)", async ({ browser }) => {
  test.setTimeout(250_000);
  const email = uniqueEmail("adminuser");
  const uid = await createConfirmedUser(email, PW, "Yönetici Admin");
  // Rol yükseltme DB trigger'ıyla korunuyor (prevent_profile_role_escalation — İYİ güvenlik).
  // Test seed'i için trigger'ı geçici kapat, rolü ayarla, geri aç.
  await runSql(`alter table profiles disable trigger prevent_profile_role_escalation;
    update profiles set role='admin' where id='${uid}';
    alter table profiles enable trigger prevent_profile_role_escalation;`);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const page = await ctx.newPage();
  await login(page, email);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/d-dashboard.png`, fullPage: true }).catch(() => {});

  // SMOKE: admin panel yüklenmeli ve SUNUCU-GERÇEK veri göstermeli (canlı panel + gerçek ilan sayısı).
  const body = await page.locator("body").innerText();
  expect(body.includes("Canlı Panel") || body.includes("Yönetim Merkezi"), "admin dashboard yüklenmeli").toBeTruthy();
  expect(/Aktif ilan|Toplam İlan/.test(body), "gerçek ilan istatistiği görünmeli").toBeTruthy();
  console.log("ADMIN DASHBOARD OK (sunucu-gerçek veri)");

  // Birkaç bölümü gez
  for (const [label, name] of [["Kullanıcılar", "users"], ["İlanlar", "listings"], ["Ayarlar", "settings"]] as const) {
    const nav = page.getByText(label, { exact: true }).first();
    if (await nav.count().then((c) => c > 0).catch(() => false)) {
      await nav.click().catch(() => {});
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/d-${name}.png`, fullPage: true }).catch(() => {});
    }
  }
  await ctx.close();
});

test("ADMIN panel görünüm (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const email = uniqueEmail("adminuserm");
  const uid = await createConfirmedUser(email, PW, "Yönetici AdminM");
  await runSql(`alter table profiles disable trigger prevent_profile_role_escalation; update profiles set role='admin' where id='${uid}'; alter table profiles enable trigger prevent_profile_role_escalation;`);

  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await login(page, email);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/m-dashboard.png`, fullPage: true }).catch(() => {});
  await ctx.close();
});
