import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

/**
 * TOPLU İLAN — Harici Ürün Kodu (SKU) upsert senkronu (Trendyol/Sahibinden modeli).
 *  1) SKU'lu CSV → önizlemede "Yeni" + publish → external_id'li ilan oluşur.
 *  2) AYNI SKU farklı fiyatla tekrar → önizlemede "Güncelle" + publish → MEVCUT ilan
 *     güncellenir, YENİ AÇILMAZ (o SKU'dan tek satır kalır).
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

async function pasteAndParse(page: Page, csv: string) {
  const ta = page.getByPlaceholder(/CSV içeriğini/i).first();
  await ta.click();
  await ta.fill(csv);
  await page.getByText("Ayrıştır ve önizle", { exact: true }).click();
  await page.waitForTimeout(1500);
}

test("Toplu ilan SKU upsert: yeni oluşturur, aynı SKU ikinci yüklemede günceller (mükerrer açmaz)", async ({ page }) => {
  const email = uniqueEmail("bulksku");
  const sellerId = await createConfirmedUser(email, PW, "E2E Bulk SKU");
  const sku = `E2E-SKU-${Date.now().toString(36)}`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, email);

  // --- 1) İLK YÜKLEME: yeni ilan (SKU dolu) ---
  await page.goto("/toplu-ilan", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const csv1 = `harici_kod,baslik,aciklama,fiyat,kategori,il,ilce,komisyon,stok,gorsel_url
${sku},E2E SKU Ürünü Birinci [E2E-TEST],Toplu yukleme SKU test urunu aciklamasi yeterince uzun,1500,Elektronik,İstanbul,Kadıköy,15,3,`;
  await pasteAndParse(page, csv1);

  let body = await page.locator("body").innerText();
  expect(body, "SKU açıklaması görünmeli").toMatch(/harici_kod|SKU/i);
  expect(body, "önizlemede 'Yeni' rozeti olmalı").toMatch(/\bYeni\b/);
  await page.screenshot({ path: "e2e-artifacts/bulk-sku-1-new.png", fullPage: true });

  // publish (yeni: buton "1 ilanı onaya gönder")
  await page.getByText(/ilanı onaya gönder/i).first().click();
  await page.waitForTimeout(6000);

  // DB: external_id'li tek ilan oluştu mu, fiyat 1500 mü?
  const after1 = await runSql<Array<{ n: number; price: number }>>(
    `select count(*)::int as n, max(price)::int as price from listings where owner_id='${sellerId}' and external_id='${sku}';`
  );
  expect(after1[0].n, "SKU'lu tek ilan oluşmalı").toBe(1);
  expect(after1[0].price, "ilk fiyat 1500 olmalı").toBe(1500);

  // --- 2) İKİNCİ YÜKLEME: aynı SKU farklı fiyat → güncelleme ---
  await page.goto("/toplu-ilan", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000); // fetchMyListingSkus tamamlansın
  const csv2 = `harici_kod,baslik,aciklama,fiyat,kategori,il,ilce,komisyon,stok,gorsel_url
${sku},E2E SKU Ürünü Guncel [E2E-TEST],Guncellenmis aciklama metni yeterince uzun olsun diye,2750,Elektronik,İstanbul,Kadıköy,18,7,`;
  await pasteAndParse(page, csv2);

  body = await page.locator("body").innerText();
  expect(body, "aynı SKU önizlemede 'Güncelle' göstermeli").toContain("Güncelle");
  await page.screenshot({ path: "e2e-artifacts/bulk-sku-2-update.png", fullPage: true });

  // publish (güncelle: buton "0 yeni · 1 güncelle")
  await page.getByText(/0 yeni · 1 güncelle/i).first().click();
  await page.waitForTimeout(6000);

  // DB: HÂLÂ tek satır, fiyat 2750'ye güncellenmiş olmalı (mükerrer açılmadı).
  const after2 = await runSql<Array<{ n: number; price: number; stock: number }>>(
    `select count(*)::int as n, max(price)::int as price, max(stock_count)::int as stock from listings where owner_id='${sellerId}' and external_id='${sku}';`
  );
  expect(after2[0].n, "aynı SKU MÜKERRER ilan AÇMAMALI (tek satır kalmalı)").toBe(1);
  expect(after2[0].price, "fiyat 2750'ye güncellenmeli").toBe(2750);
  expect(after2[0].stock, "stok 7'ye güncellenmeli").toBe(7);
});
