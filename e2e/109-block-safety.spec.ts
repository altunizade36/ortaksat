import { test, expect, devices, type Page } from "@playwright/test";

// Engelleme/şikayet güvenlik özelliği (Apple UGC 1.2) regresyon koruması.
// Canlıya karşı, anonim yüzeyler: /engellenenler rotası + mağaza sayfası engelle butonu.
const STORE = "/store/f3ed367b-bf42-46c8-95a6-ac8bc284dcd3"; // OrtakSat Vitrin (herkese açık)

function guardErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  return errs;
}

test("Engellenenler rotası yükleniyor (anon → içerik veya giriş kapısı, çökme yok)", async ({ page }) => {
  const errs = guardErrors(page);
  await page.goto("/engellenenler", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const body = await page.evaluate(() => document.body.innerText);
  // Anonim: giriş kapısı; girişli: engellenenler listesi/başlık. Her hâlde çökmemeli.
  expect(body).toMatch(/Engellenen|Blocked|giriş|Sign in/i);
  const fatal = errs.filter((e) => /is not a function|undefined is not|Cannot read|Minified React error/i.test(e));
  expect(fatal, `JS hata: ${fatal.join(" ; ")}`).toHaveLength(0);
});

test("Mağaza sayfasında engelle butonu görünür (masaüstü, anon)", async ({ page }) => {
  await page.goto(STORE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  // Masaüstü sidebar'da metinli buton: "Kullanıcıyı engelle" / "Block user".
  const blockBtn = page
    .getByText(/Kullanıcıyı engelle|Block user/i)
    .or(page.getByLabel(/Kullanıcıyı engelle|Block user/i));
  await expect(blockBtn.first()).toBeVisible({ timeout: 9000 });
  // Şikayet et de yanında olmalı (güvenlik aksiyonları birlikte).
  await expect(page.getByText(/şikayet et|Report/i).first()).toBeVisible({ timeout: 4000 });
});

test("Mağaza sayfasında engelle erişimi (mobil, anon)", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto(STORE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  // Mobilde ikon-butonu → accessibilityLabel (aria-label) ile bulunur.
  const blockBtn = page.getByLabel(/Kullanıcıyı engelle|Block user/i);
  await expect(blockBtn.first()).toBeVisible({ timeout: 9000 });
  await ctx.close();
});
