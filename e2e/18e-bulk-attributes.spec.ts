import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql, E2E_LISTING_TAG } from "./helpers/supabase-admin";

/**
 * TOPLU İLAN — kategoriye özel alanlar: CSV'ye eklenen ekstra sütun başlıkları o
 * kategorinin şema alanının ETİKETİ (Marka) veya ANAHTARI (condition) ile eşleşirse
 * attributes JSONB'ye yazılır (özellik tablosu + filtrelerde görünür). Migrasyonsuz.
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

test("Toplu ilan: kategori-özel sütunlar (Marka/Renk/condition) attributes'a eşlenir", async ({ page }) => {
  const email = uniqueEmail("bulkattr");
  const sellerId = await createConfirmedUser(email, PW, "E2E Bulk Attr");
  const sku = `E2E-ATTR-${Date.now().toString(36)}`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, email);
  await page.goto("/toplu-ilan", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  // Elektronik şeması: Marka(brand,text) / Renk(color,select) / condition(Ürün durumu,select).
  // "Marka" TR etiketiyle, "condition" İngilizce anahtarla eşleşmeli.
  const csv = `harici_kod,baslik,aciklama,fiyat,kategori,il,ilce,komisyon,stok,gorsel_url,Marka,Renk,condition
${sku},E2E Ozellikli Urun ${E2E_LISTING_TAG},Kategori ozel alan testi icin yeterince uzun aciklama metni,3500,Elektronik,İstanbul,Kadıköy,15,2,,Apple,Mavi,İkinci El`;
  const ta = page.getByPlaceholder(/CSV içeriğini/i).first();
  await ta.click();
  await ta.fill(csv);
  await page.getByText("Ayrıştır ve önizle", { exact: true }).click();
  await page.waitForTimeout(1500);

  const body = await page.locator("body").innerText();
  expect(body, "önizlemede tanınan özellik göstergesi olmalı").toContain("özellik");
  expect(body, "Marka özelliği tanınmalı").toContain("Marka");
  await page.screenshot({ path: "e2e-artifacts/bulk-attributes.png", fullPage: true });

  await page.getByText(/ilanı onaya gönder/i).first().click();
  await page.waitForTimeout(6000);

  // DB: attributes JSONB brand/color/condition içermeli (select değerleri kanonik eşlendi).
  const rows = await runSql<Array<{ brand: string; color: string; condition: string }>>(
    `select attributes->>'brand' as brand, attributes->>'color' as color, attributes->>'condition' as condition
     from listings where owner_id='${sellerId}' and external_id='${sku}';`
  );
  expect(rows[0]?.brand, "Marka → attributes.brand").toBe("Apple");
  expect(rows[0]?.color, "Renk → attributes.color (kanonik seçenek)").toBe("Mavi");
  expect(rows[0]?.condition, "condition → attributes.condition (kanonik seçenek)").toBe("İkinci El");
});
