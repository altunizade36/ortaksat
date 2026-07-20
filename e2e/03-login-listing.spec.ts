import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, runSql, E2E_LISTING_TAG, resetAuthRateLimits } from "./helpers/supabase-admin";

/**
 * YAZMA akışı: giriş + ilan verme. SQL ile onaylı hesap oluşturur (GoTrue hız
 * sınırını atlar), UI'dan giriş yapar, ilan verme sihirbazını dener. Amaç:
 * "giriş çalışıyor mu, ilan yayınlanabiliyor mu, nerede görünüyor?" sorularını
 * yanıtlamak. Tüm veri global-teardown'da silinir.
 */

const PASSWORD = "GucluSifre123!";

async function loginViaUI(page: Page, email: string, password: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(password);
  // "Giriş Yap" — sekme + buton; gönder butonu SON eşleşme.
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  // Giriş sonrası ana sayfaya/hoşgeldin'e yönlenir.
  await page.waitForTimeout(4000);
}

test("SQL ile oluşturulan hesapla UI'dan giriş yapılabiliyor", async ({ page }) => {
  const email = uniqueEmail("login");
  await createConfirmedUser(email, PASSWORD, "E2E Login");

  await loginViaUI(page, email, PASSWORD);
  await page.screenshot({ path: "e2e-artifacts/after-login.png", fullPage: true });

  // Giriş başarılıysa: artık /auth'ta değiliz VE bir yerlerde "Çıkış" / hesap menüsü var.
  const url = page.url();
  const body = (await page.locator("body").innerText()).toLowerCase();
  const loggedIn = !url.includes("/auth") || body.includes("çıkış") || body.includes("hesabım") || body.includes("hoş geldin");
  expect(loggedIn, `giriş sonrası oturum açılmalı (url=${url})`).toBeTruthy();
});

test("anonim /create FORMU görür (kapı Yayınla'da), giriş sonrası da form", async ({ page }) => {
  // YENİ DAVRANIŞ: anonim kullanıcı ilan formunu doldurabilir; kayıt duvarı BAŞTA değil
  // yalnız "Yayınla" anında çıkar. Yani /create'e girişsiz gelince FORM görünmeli, birincil
  // kapı metni ("İlan vermek için giriş yapın") görünmemeli.
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const guestBody = (await page.locator("body").innerText()).toLowerCase();
  await page.screenshot({ path: "e2e-artifacts/create-guest.png", fullPage: true });
  expect(guestBody.includes("i̇lan vermek için giriş yapın") || guestBody.includes("ilan vermek için giriş yapın"), "anonim /create BAŞTA kayıt duvarı GÖSTERMEMELİ (form görünmeli)").toBeFalsy();
  const guestHasForm = ["başlık", "kategori", "fiyat", "ürün", "ileri", "adım", "ilan"].filter((w) => guestBody.includes(w)).length >= 2;
  expect(guestHasForm, "anonim /create ilan formunu göstermeli").toBeTruthy();

  // Şimdi giriş yap, /create'e dön: sihirbaz/form görünmeli (kapı değil).
  const email = uniqueEmail("create");
  await createConfirmedUser(email, PASSWORD, "E2E Create");
  await loginViaUI(page, email, PASSWORD);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e-artifacts/create-loggedin.png", fullPage: true });
  const body = (await page.locator("body").innerText()).toLowerCase();
  // İlan verme adımlarına dair bir işaret: "başlık", "kategori", "fiyat", "ürün", "ileri" vb.
  const hasWizard = ["başlık", "kategori", "fiyat", "ürün", "ileri", "adım", "ilan"].filter((w) => body.includes(w)).length >= 2;
  expect(hasWizard, "giriş sonrası /create ilan verme adımlarını göstermeli").toBeTruthy();
});

test("kullanıcının ilanı DB'de oluşturulunca keşfet/kategori/detayda görünür", async ({ page }) => {
  // İlanı doğrudan DB'ye ekleyip (owner = test kullanıcı) görünürlüğü UI'da doğrularız.
  // Böylece "ilan yayınlanınca nerede görünüyor?" sorusunu deterministik test ederiz.
  const email = uniqueEmail("seller");
  const ownerId = await createConfirmedUser(email, PASSWORD, "E2E Satici");
  const title = `E2E Test Koltuk Takımı ${E2E_LISTING_TAG}`;
  const rows = await runSql<Array<{ id: string; slug: string }>>(`
    insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency)
    values ('${ownerId}', '${title}', 'e2e-test-koltuk-${Date.now()}', 'E2E test açıklaması: dayanıklı, temiz, ikinci el koltuk takımı. Otomatik test verisidir.', 12500, 'rate', 10, 'Ev & Yaşam', 'İstanbul', 'active', 'open', 'TRY')
    returning id, slug;
  `);
  const listingId = rows[0]?.id;
  expect(listingId, "ilan DB'ye eklenmeli").toBeTruthy();

  // İlan detay sayfası açılmalı ve başlığı göstermeli.
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e-artifacts/e2e-listing-detail.png", fullPage: true });
  const detailBody = await page.locator("body").innerText();
  expect(detailBody, "ilan detayı başlığı göstermeli").toContain("E2E Test Koltuk");

  // Keşfet'te aranınca çıkmalı.
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const search = page.locator("input[type='text'], input:not([type])").first();
  if (await search.count()) {
    await search.fill("E2E Test Koltuk");
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: "e2e-artifacts/e2e-listing-search.png", fullPage: true });
  const exploreBody = await page.locator("body").innerText();
  expect(exploreBody, "ilan keşfet aramasında görünmeli").toContain("Koltuk");
});
