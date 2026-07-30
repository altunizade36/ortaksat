import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql, E2E_LISTING_TAG } from "./helpers/supabase-admin";

/**
 * TOPLU İLAN — CSV giriş/çıkış iyileştirmeleri:
 *  A) Türkçe Excel NOKTALI VİRGÜL (;) ayraçlı CSV otomatik algılanır (yoksa tüm satır tek hücre).
 *  B) "Mevcut ilanlarımı dışa aktar" → şablon sütunlu CSV indirir (harici_kod dahil) — upsert döngüsü.
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

test("Türkçe Excel ; ayraçlı CSV otomatik algılanır ve doğru ayrışır", async ({ page }) => {
  const email = uniqueEmail("bulksemi");
  const sellerId = await createConfirmedUser(email, PW, "E2E Bulk Semi");
  const sku = `E2E-SEMI-${Date.now().toString(36)}`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, email);
  await page.goto("/toplu-ilan", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  // ; ayraçlı (TR Excel çıktısı gibi) — virgül ondalık değil ayraç sanılırsa bozulurdu.
  const csvSemi = `harici_kod;baslik;aciklama;fiyat;kategori;il;ilce;komisyon;stok;gorsel_url
${sku};E2E Noktali Virgul Urunu ${E2E_LISTING_TAG};Aciklama metni yeterince uzun olsun diye burada duruyor;1250;Elektronik;İstanbul;Kadıköy;12;4;`;
  const ta = page.getByPlaceholder(/CSV içeriğini/i).first();
  await ta.click();
  await ta.fill(csvSemi);
  await page.getByText("Ayrıştır ve önizle", { exact: true }).click();
  await page.waitForTimeout(1500);

  const body = await page.locator("body").innerText();
  expect(body, "önizlemede geçerli (1/1) olmalı").toMatch(/1\/1/);
  expect(body, "il İstanbul olarak eşleşmeli (; ayraç doğru bölündü)").toContain("İstanbul");
  await page.screenshot({ path: "e2e-artifacts/bulk-semicolon.png", fullPage: true });

  await page.getByText(/ilanı onaya gönder/i).first().click();
  await page.waitForTimeout(6000);

  const rows = await runSql<Array<{ n: number; price: number }>>(
    `select count(*)::int as n, max(price)::int as price from listings where owner_id='${sellerId}' and external_id='${sku}';`
  );
  expect(rows[0].n, "; ayraçlı satır ilana dönüşmeli").toBe(1);
  expect(rows[0].price, "fiyat 1250 doğru ayrışmalı").toBe(1250);
});

test("Mevcut ilanlarımı dışa aktar: şablon sütunlu CSV (harici_kod dahil) indirir", async ({ page }) => {
  const email = uniqueEmail("bulkexp");
  const sellerId = await createConfirmedUser(email, PW, "E2E Bulk Export");
  const sku = `E2E-EXP-${Date.now().toString(36)}`;
  // Dışa aktarılacak ilanı doğrudan seed et (external_id'li).
  await runSql(`insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency, external_id, stock_count)
    values ('${sellerId}', 'E2E Export Urunu ${E2E_LISTING_TAG}', 'e2e-exp-${Date.now()}', 'E2E export testi urun aciklamasi yeterince uzun.', 4990, 'rate', 14, 'Elektronik', 'İstanbul', 'active', 'open', 'TRY', '${sku}', 9);`);

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, email);
  await page.goto("/toplu-ilan", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Mevcut ilanlarımı dışa aktar", { exact: true }).click();
  const download = await downloadPromise;
  const p = await download.path();
  const content = fs.readFileSync(p as string, "utf8");

  expect(content, "başlık satırında harici_kod olmalı").toContain("harici_kod");
  expect(content, "seed ilanın SKU'su CSV'de olmalı").toContain(sku);
  expect(content, "seed ilanın fiyatı CSV'de olmalı").toContain("4990");
});
