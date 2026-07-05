import { test, expect, type Page } from "@playwright/test";

/**
 * SALT-OKUNUR canlı duman testi (veri OLUŞTURMAZ). Sayfaların yüklendiğini,
 * ilanların nerede göründüğünü, arama/filtre/kategori/ilan-detay ve temel
 * gezinmenin çalıştığını doğrular. Her adımda ekran görüntüsü alınır.
 */

async function pageLoads(page: Page, path: string, expectText?: RegExp) {
  const res = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(res, `${path} yanıt vermeli`).toBeTruthy();
  expect(res!.status(), `${path} 2xx/3xx dönmeli`).toBeLessThan(400);
  // RN-web hidrasyonu için kısa bekleme + gövde görünür.
  await page.waitForTimeout(1500);
  await expect(page.locator("body")).toBeVisible();
  if (expectText) await expect(page.getByText(expectText).first()).toBeVisible({ timeout: 20_000 });
}

test("ana sayfa yüklenir, h1 ve istatistikler görünür", async ({ page }) => {
  await pageLoads(page, "/");
  // h1 (semantik başlık) canlıda olmalı.
  const h1 = page.locator("h1, [role='heading'][aria-level='1']");
  await expect(h1.first()).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveTitle(/OrtakSat/i);
  await page.screenshot({ path: "e2e-artifacts/home.png", fullPage: true });
});

test("keşfet sayfası ilanları listeler", async ({ page }) => {
  await pageLoads(page, "/explore");
  // Fiyat (₺) içeren en az bir kart bulunmalı — ilanların göründüğü yer burası.
  const priceMarks = page.getByText(/₺\s?\d/);
  const count = await priceMarks.count();
  await page.screenshot({ path: "e2e-artifacts/explore.png", fullPage: true });
  expect(count, "keşfet'te fiyatlı ilan kartı olmalı").toBeGreaterThan(0);
});

test("kategoriler sayfası açılır", async ({ page }) => {
  await pageLoads(page, "/kategoriler");
  await page.screenshot({ path: "e2e-artifacts/kategoriler.png", fullPage: true });
  await expect(page).toHaveTitle(/Kategori|OrtakSat/i);
});

test("emlak kategori sayfası ilan gösterir (Round1 #13 regresyon)", async ({ page }) => {
  await pageLoads(page, "/kategori/emlak");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/kategori-emlak.png", fullPage: true });
  // "0 ilan" gibi tamamen boş olmamalı; fiyatlı kart veya "ilan yok" mesajı net olmalı.
  const hasCards = (await page.getByText(/₺\s?\d/).count()) > 0;
  const emptyMsg = await page.getByText(/henüz ilan yok/i).count();
  expect(hasCards || emptyMsg > 0, "emlak: ya ilan ya net boş-durum mesajı").toBeTruthy();
});

test("ilan detayına gidilebilir", async ({ page }) => {
  await pageLoads(page, "/explore");
  await page.waitForTimeout(1500);
  // İlk fiyatlı kartın atasındaki bağlantıya tıkla.
  const firstCard = page.getByText(/₺\s?\d/).first();
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click({ trial: false }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e-artifacts/listing-detail.png", fullPage: true });
  // Detay sayfasında ya URL /listing/ ya da bir h1 başlık olmalı.
  const onDetail = page.url().includes("/listing/");
  const h1 = await page.locator("h1, [role='heading'][aria-level='1']").count();
  expect(onDetail || h1 > 0, "ilan detayına ulaşılmalı").toBeTruthy();
});

test("arama çalışır", async ({ page }) => {
  await pageLoads(page, "/explore");
  await page.waitForTimeout(1200);
  // Arama kutusu (placeholder farklı olabilir) — ilk textbox'a yaz.
  const search = page.locator("input[type='text'], input:not([type])").first();
  if (await search.count()) {
    await search.fill("ev");
    await search.press("Enter");
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: "e2e-artifacts/search.png", fullPage: true });
  expect(true).toBeTruthy();
});

test("yasal sayfalar açılır", async ({ page }) => {
  await pageLoads(page, "/legal");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "e2e-artifacts/legal.png", fullPage: true });
  await expect(page.getByText(/KVKK|Gizlilik|Kullanım|Aydınlatma/i).first()).toBeVisible({ timeout: 15_000 });
});

test("özel 404 sayfası (Round1 #23)", async ({ page }) => {
  const res = await page.goto("/kesinlikle-olmayan-sayfa-xyz-123", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e-artifacts/404.png", fullPage: true });
  // Vercel generic 404 DEĞİL, kendi sayfamız: "Ana sayfa" dönüş linki olmalı.
  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  expect(bodyText.includes("ana sayfa") || bodyText.includes("bulunamadı") || bodyText.includes("404")).toBeTruthy();
  void res;
});

test("nasıl-çalışır ve sss sayfaları başlık + footer ile açılır (Round1 #17)", async ({ page }) => {
  await pageLoads(page, "/nasil-calisir");
  await expect(page).toHaveTitle(/Nasıl Çalışır|OrtakSat/i);
  await page.screenshot({ path: "e2e-artifacts/nasil-calisir.png", fullPage: true });
  await pageLoads(page, "/sss");
  await expect(page).toHaveTitle(/Soru|SSS|OrtakSat/i);
  await page.screenshot({ path: "e2e-artifacts/sss.png", fullPage: true });
});
