import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql, E2E_LISTING_TAG } from "./helpers/supabase-admin";

/**
 * TOPLU İLAN — çoklu görsel: gorsel_url'e | ile ayrılmış birden çok URL → kapak + galeri (adAssets).
 * Büyük pazaryeri katalogları ürün başına birden çok görsel taşır; tek foto ilan zayıf görünür.
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

test("Toplu ilan: gorsel_url'de | ile çoklu görsel → kapak + galeri (adAssets)", async ({ page }) => {
  const email = uniqueEmail("bulkimg");
  const sellerId = await createConfirmedUser(email, PW, "E2E Bulk Img");
  const sku = `E2E-IMG-${Date.now().toString(36)}`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, email);
  await page.goto("/toplu-ilan", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  // 3 görsel: ilki kapak (listing_images sort_order 0), diğer 2'si adAssets.
  const csv = `harici_kod,baslik,aciklama,fiyat,kategori,il,ilce,komisyon,stok,gorsel_url
${sku},E2E Cok Gorsel Urunu ${E2E_LISTING_TAG},Urun aciklamasi galeri testi icin yeterince uzun metin,1900,Elektronik,İstanbul,Kadıköy,15,2,https://cdn.example.com/a.jpg|https://cdn.example.com/b.jpg|https://cdn.example.com/c.jpg`;
  const ta = page.getByPlaceholder(/CSV içeriğini/i).first();
  await ta.click();
  await ta.fill(csv);
  await page.getByText("Ayrıştır ve önizle", { exact: true }).click();
  await page.waitForTimeout(1500);

  const body = await page.locator("body").innerText();
  expect(body, "önizlemede galeri sayısı görünmeli").toContain("3 görsel");
  await page.screenshot({ path: "e2e-artifacts/bulk-multi-image.png", fullPage: true });

  await page.getByText(/ilanı onaya gönder/i).first().click();
  await page.waitForTimeout(6000);

  // DB: ad_assets 2 ek görsel içermeli; kapak listing_images sort_order 0'da olmalı.
  const rows = await runSql<Array<{ n_extra: number }>>(
    `select coalesce(array_length(ad_assets,1),0)::int as n_extra from listings where owner_id='${sellerId}' and external_id='${sku}';`
  );
  expect(rows[0].n_extra, "ilki kapak, kalan 2 görsel adAssets'e gitmeli").toBe(2);

  const cover = await runSql<Array<{ n: number }>>(
    `select count(*)::int as n from listing_images where listing_id=(select id from listings where owner_id='${sellerId}' and external_id='${sku}') and sort_order=0;`
  );
  expect(cover[0].n, "kapak görsel listing_images'ta olmalı").toBe(1);
});
