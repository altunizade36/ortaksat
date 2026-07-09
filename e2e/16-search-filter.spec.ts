import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, runSql, E2E_LISTING_TAG, resetAuthRateLimits } from "./helpers/supabase-admin";

/**
 * Arama & filtreleme düzeltmelerinin canlı doğrulaması:
 *  - Arama Türkçe-katlama fallback: "sisli" araması "Şışlı" başlıklı ilanı bulur
 *    (sunucu ilike bulamaz → istemci searchKey fold + fuzzy fallback).
 *  - Partner fırsatları mobilde komisyon/sıralama çipleri gösterir.
 */

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(4000);
}

test("Arama Türkçe-katlama fallback: 'sisli' → 'Şışlı' ilanını bulur", async ({ page }) => {
  const ownerId = await createConfirmedUser(uniqueEmail("srch"), PW, "E2E Arama");
  const stamp = Date.now();
  const token = `Sisli${stamp}`.replace("Sisli", "Şışlı"); // "Şışlı<stamp>" (Türkçe harfli)
  const title = `${token} Powerbank E2E ${E2E_LISTING_TAG}`;
  await runSql(`
    insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency)
    values ('${ownerId}', '${title}', 'e2e-sarj-${stamp}', 'Otomatik test — hızlı şarj powerbank orijinal kutulu.', 500, 'rate', 10, 'Elektronik', 'İstanbul', 'active', 'open', 'TRY');
  `);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  // Arama kutusuna katlanmış sorguyu yaz (Türkçe klavye olmadan): sunucu ilike "Şışlı"yı
  // bulamaz → istemci searchKey fold + fuzzy fallback bulur. Arama modunda feed filtrelenir,
  // yani sonuç yalnızca eşleşenler olur (newest-rail yanılması olmaz).
  const search = page.locator("input[type='text'], input:not([type])").first();
  await search.fill(`sisli${stamp}`);
  await search.press("Enter");
  await page.waitForTimeout(5000);
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/search-fold.png", fullPage: true });
  const body = await page.locator("body").innerText();
  expect(body, "katlanmış arama Türkçe-harfli ilanı bulmalı").toContain(token);
});

test("Aktif-filtre çipleri (mobil): il/ilçe seçiliyken 'Tümünü temizle' görünür", async ({ page }) => {
  // Çipler mobil ağaçta yaşar (masaüstünde zaten LocationSelector × + toolbar 'Filtreleri temizle' var).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore?province=istanbul&district=kadikoy", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: "e2e-artifacts/active-chips.png", fullPage: true });
  const body = await page.locator("body").innerText();
  // İl + ilçe = 2 çip → "Tümünü temizle" çıkar.
  expect(body, "aktif-filtre çipleriyle 'Tümünü temizle' görünmeli").toContain("Tümünü temizle");
});

test("Partner fırsatları mobilde komisyon + sıralama çipleri gösterir", async ({ page }) => {
  const email = uniqueEmail("pfilter");
  await createConfirmedUser(email, PW, "E2E Partner Filter");
  await login(page, email);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/partner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: "e2e-artifacts/partner-mobile-filters.png", fullPage: true });
  const body = await page.locator("body").innerText();
  expect(body, "komisyon çipi görünmeli").toContain("%10+");
  expect(body, "sıralama çipi görünmeli").toContain("Yüksek komisyon");
});
