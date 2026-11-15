import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

/**
 * Yönetim paneli → Kullanıcılar: canlı üye özeti, üyelik tarihi / son görülme sütunları, sıralama ve süzgeçler.
 * Geçici bir yönetici hesabı açılır (rol yükseltme tetikleyicisi yalnız bu güncelleme için kapatılır) ve
 * test sonunda genel temizlik (global-teardown) hesabı siler.
 */
const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/admin-members";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByRole("button", { name: "E-posta ile giriş yap" }).last().click();
  await page.waitForTimeout(5500);
}

async function makeAdmin(tag: string, name: string) {
  const email = uniqueEmail(tag);
  const uid = await createConfirmedUser(email, PW, name);
  await runSql(`alter table profiles disable trigger prevent_profile_role_escalation;
    update profiles set role='admin' where id='${uid}';
    alter table profiles enable trigger prevent_profile_role_escalation;`);
  return { email, uid };
}

test("yönetim: üyeler canlı durum, sıralama ve süzgeçler (masaüstü)", async ({ browser }) => {
  test.setTimeout(240_000);
  const { email, uid } = await makeAdmin("adminmembers", "Yönetici Üyeler");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2000 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  await login(page, email);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.getByText("Kullanıcılar", { exact: true }).first().click();

  // Canlı özet yüklendi: giriş yapan yönetici kendisi çevrim içi sayılır (sinyal girişte gönderilir).
  await expect(page.getByText("Üyeler: canlı durum")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Şu an çevrim içi")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Son 30 gün: yeni üye ve günlük aktif")).toBeVisible();
  await expect(page.getByText("Giriş yöntemi", { exact: true })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/d-users.png`, fullPage: true });

  // Sunucu: sinyal ortamı kaydedildi mi (web)?
  const presence = await runSql<Array<{ platform: string | null }>>(`select platform from public.user_presence where user_id='${uid}'`);
  expect(presence[0]?.platform, "çevrim içi sinyali ortamı kaydetmeli").toBe("web");

  // Varsayılan sıra: en yeni üye en üstte → az önce açılan test hesabı ilk satır.
  const body = await page.locator("body").innerText();
  const firstRow = body.indexOf("Yönetici Üyeler");
  expect(firstRow, "yeni açılan hesap listede olmalı").toBeGreaterThan(-1);
  expect(body).toContain("ÜYELİK");
  expect(body).toContain("SON GÖRÜLME");

  // "En eski üye" sırası: test hesabı artık ilk sayfanın başında değil.
  await page.getByText("En eski üye", { exact: true }).click();
  await page.waitForTimeout(800);
  const oldest = await page.locator("body").innerText();
  const tableStart = oldest.indexOf("SON GÖRÜLME");
  const firstNumber = oldest.slice(tableStart).match(/#(\d+) · /);
  expect(firstNumber?.[1], "en eski sırada ilk satır 1 numaralı üye olmalı").toBe("1");

  // "Çevrim içi" süzgeci: yalnız içeridekiler; yönetici kendisi listede.
  await page.getByText("En yeni üye", { exact: true }).click();
  await page.getByRole("button", { name: /^Çevrim içi/ }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText(/Yönetici Üyeler \(sen\)/).first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/d-users-online.png`, fullPage: true });

  // Ayrıntı kartı: üyelik ve giriş bilgileri.
  await page.getByText(/Yönetici Üyeler \(sen\)/).first().click();
  await expect(page.getByText("SON OTURUM AÇMA")).toBeVisible();
  await expect(page.getByText("Şu an çevrim içi").first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/d-users-detail.png`, fullPage: true });
  expect(errors, "sayfa hatası olmamalı").toEqual([]);
  await ctx.close();
});

test("yönetim: üyeler bölümü telefonda taşmadan çizilir", async ({ browser }) => {
  test.setTimeout(200_000);
  const { email } = await makeAdmin("adminmembersm", "Yönetici Mobil");
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await login(page, email);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.getByText("Kullanıcılar", { exact: true }).first().click();
  await expect(page.getByText("Üyeler: canlı durum")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3000);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "yatay taşma olmamalı").toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${OUT}/m-users.png`, fullPage: true });

  // Telefon alt çubuğu: dört ana bölüm + menü; dokununca bölüm değişir, "Tümü" çekmeceyi açar.
  await expect(page.getByTestId("admin-bottom-users")).toBeVisible();
  await page.getByTestId("admin-bottom-listings").click();
  await expect(page.getByText("İlan Moderasyonu").first()).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("admin-bottom-menu").click();
  await expect(page.getByText("OrtakSat Yönetim", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Ayarlar/ }).first().click();
  await expect(page.getByText("Platform Ayarları").first()).toBeVisible({ timeout: 10_000 });
  await ctx.close();
});
