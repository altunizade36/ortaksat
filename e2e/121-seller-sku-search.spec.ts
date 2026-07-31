import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql, E2E_LISTING_TAG } from "./helpers/supabase-admin";

/**
 * SATICI PANELİ güçlendirme: harici ürün kodu (SKU) hem ilan satırında GÖRÜNÜR hem de
 * kendi kataloğunda SKU ile ARANABİLİR (yüzlerce toplu-yüklü ilanda ürünü koddan bul).
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

test("Satıcı paneli: SKU ilan satırında görünür + SKU ile aranabilir", async ({ page }) => {
  const email = uniqueEmail("selsku");
  const sellerId = await createConfirmedUser(email, PW, "E2E Seller SKU");
  const sku = `E2E-SELLER-${Date.now().toString(36)}`;
  const title = `E2E SKU Vitrin Urunu ${E2E_LISTING_TAG}`;
  // İki ilan: biri SKU'lu (aranacak), biri SKU'suz (filtreyle elenmeli).
  await runSql(`insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency, external_id, stock_count)
    values ('${sellerId}', '${title}', 'e2e-sku-${Date.now()}', 'Satici paneli SKU testi urun aciklamasi yeterince uzun.', 4200, 'rate', 12, 'Elektronik', 'İstanbul', 'active', 'approval', 'TRY', '${sku}', 5);`);
  await runSql(`insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency, stock_count)
    values ('${sellerId}', 'E2E Kodsuz Diger Urun ${E2E_LISTING_TAG}', 'e2e-nosku-${Date.now()}', 'Kodsuz diger ilan aciklamasi yeterince uzun metin.', 999, 'rate', 10, 'Elektronik', 'İstanbul', 'active', 'approval', 'TRY', 4);`);

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, email);
  await page.goto("/(tabs)/seller", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  // Panel varsayılan "Özet" sekmesinde açılır; ilanlar (SKU + arama) "İlanlarım" sekmesinde.
  await page.getByText("İlanlarım", { exact: false }).first().click();
  await page.waitForTimeout(1500);

  let body = await page.locator("body").innerText();
  expect(body, "ilan satırında SKU görünmeli").toContain(sku);
  // Placeholder bir ATTRIBUTE'tur (innerText'e girmez) → locator ile kontrol et.
  expect(await page.getByPlaceholder(/ürün kodu/i).count(), "arama placeholder'ı ürün kodunu belirtmeli").toBeGreaterThan(0);
  await page.screenshot({ path: "e2e-artifacts/seller-sku.png", fullPage: true });

  // SKU ile ara → SKU'lu ilan kalır, kodsuz diğer ilan elenir.
  const search = page.getByPlaceholder(/ürün kodu/i).first();
  await search.click();
  await search.fill(sku);
  await page.waitForTimeout(1200);
  body = await page.locator("body").innerText();
  expect(body, "SKU araması SKU'lu ilanı bulmalı").toContain("E2E SKU Vitrin Urunu");
  expect(body, "SKU araması kodsuz ilanı elemeli").not.toContain("E2E Kodsuz Diger Urun");
});
