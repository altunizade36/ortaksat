import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, runSql, E2E_LISTING_TAG } from "./helpers/supabase-admin";

/**
 * YAZMA akışı: alıcı/ortak etkileşimleri — favori (Beğen), ortak olma (Hemen
 * Ortak Ol ve Kazan), mesaj gönderme (Mesaj gönder). Her biri UI'dan yapılır ve
 * DB'de doğru kaydın oluştuğu SQL ile doğrulanır. Tüm veri teardown'da silinir.
 */

const PW = "GucluSifre123!";

async function seedSellerListing(): Promise<{ ownerId: string; listingId: string }> {
  const ownerId = await createConfirmedUser(uniqueEmail("seller"), PW, "E2E Satici");
  const rows = await runSql<Array<{ id: string }>>(`
    insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency)
    values ('${ownerId}', 'E2E Etkilesim Koltuk ${E2E_LISTING_TAG}', 'e2e-etkilesim-${Date.now()}', 'E2E etkileşim testi ürünü: dayanıklı, temiz, konforlu ikinci el koltuk takımı. Otomatik test verisidir.', 9900, 'rate', 12, 'Ev & Yaşam', 'İstanbul', 'active', 'open', 'TRY')
    returning id;`);
  return { ownerId, listingId: rows[0].id };
}

async function loginBuyer(page: Page): Promise<string> {
  const email = uniqueEmail("buyer");
  const buyerId = await createConfirmedUser(email, PW, "E2E Alici");
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(4000);
  return buyerId;
}

test("FAVORİ: 'Beğen' → favorites kaydı oluşur", async ({ page }) => {
  const { listingId } = await seedSellerListing();
  const buyerId = await loginBuyer(page);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.getByText("Beğen", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/favorite.png", fullPage: true });

  const rows = await runSql<Array<{ n: number }>>(
    `select count(*) as n from favorites where user_id='${buyerId}' and listing_id='${listingId}';`
  );
  expect(Number(rows[0].n), "favori DB'ye yazılmalı").toBeGreaterThan(0);
});

test("ORTAK OL: 'Hemen Ortak Ol ve Kazan' → partnership/lead kaydı oluşur", async ({ page }) => {
  const { listingId } = await seedSellerListing();
  const buyerId = await loginBuyer(page);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.getByText(/Hemen Ortak Ol ve Kazan/i).first().click();
  await page.waitForTimeout(2000);
  // Açılan panelde ikinci bir onay/başvuru butonu olabilir — varsa tıkla.
  const confirm = page.getByText(/Ortak ol|Başvur|Onayla|Gönder|Bağlantı/i);
  if (await confirm.count()) await confirm.last().click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/ortak.png", fullPage: true });

  const rows = await runSql<Array<{ n: number }>>(
    `select
       (select count(*) from partnerships where partner_id='${buyerId}' and listing_id='${listingId}') +
       (select count(*) from referral_public_links where listing_id='${listingId}') as n;`
  );
  expect(Number(rows[0].n), "ortaklık/referans kaydı oluşmalı").toBeGreaterThan(0);
});

test("MESAJ: 'Mesaj gönder' → conversation/message oluşur", async ({ page }) => {
  const { listingId, ownerId } = await seedSellerListing();
  const buyerId = await loginBuyer(page);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.getByText("Mesaj gönder", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  // Mesaj composer'ı açıldıysa yaz + gönder.
  const box = page.locator("textarea, input[type='text'], input:not([type])").last();
  if (await box.count()) {
    await box.fill("Merhaba, bu ürün hâlâ mevcut mu? (E2E test mesajı)").catch(() => {});
    // Gönder butonu / Enter.
    const send = page.getByText(/Gönder/i).last();
    if (await send.count()) await send.click().catch(() => {});
    else await box.press("Enter").catch(() => {});
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/mesaj.png", fullPage: true });

  const rows = await runSql<Array<{ n: number }>>(
    `select
       (select count(*) from conversations where listing_id='${listingId}' and (buyer_id='${buyerId}' or partner_id='${buyerId}')) +
       (select count(*) from messages where listing_id='${listingId}' and (sender_id='${buyerId}' or receiver_id='${ownerId}')) as n;`
  );
  expect(Number(rows[0].n), "mesaj/conversation kaydı oluşmalı").toBeGreaterThan(0);
});
