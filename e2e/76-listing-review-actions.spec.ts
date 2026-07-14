import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);
}

/**
 * İLAN SAYFASI YORUM YETKİLERİ: eskiden ilan detayı yorumları SALT-OKUNUR bir kopyayla
 * çiziyordu — kendi yorumunu düzenleyemiyor, satıcı yanıt veremiyordun (bunlar yalnız
 * mağaza sayfasında vardı). Artık iki sayfa da paylaşılan ReviewCard'ı kullanıyor.
 * Burada ilan sayfasından düzenlemenin gerçekten DB'ye yazdığını kanıtlıyoruz.
 */
test("İLAN SAYFASI: kendi yorumunu düzenle → DB'ye yazılır", async ({ page }) => {
  test.setTimeout(600_000);

  const sellerEmail = uniqueEmail("rvwseller");
  const buyerEmail = uniqueEmail("rvwbuyer");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E YorumSatici");
  const buyerId = await createConfirmedUser(buyerEmail, PW, "E2E YorumAlici");

  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'E2E YORUM URUNU',
            'e2e-rvw-' || substr(md5(random()::text),1,8), 'İstanbul', 'test', 'Cep Telefonu',
            50000, 'rate', 10, 'active', 5, false, 'open')
    returning id`);
  const listingId = l!.id;

  const r = await one<{ id: string }>(`insert into reviews
    (id, listing_id, reviewer_id, reviewed_user_id, rating, comment, type, helpful_count, created_at)
    values (gen_random_uuid(), '${listingId}', '${buyerId}', '${sellerId}', 3,
            'ILK HALI yazim hatasi var', 'product', 0, now())
    returning id`);
  const reviewId = r!.id;

  await login(page, buyerEmail);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  // Yorumumun altında "Düzenle" görünmeli (eskiden HİÇ yoktu)
  const duzenle = page.getByText(/^Düzenle$/).first();
  await expect(duzenle, "ilan sayfasında kendi yorumunda Düzenle olmalı").toBeVisible();
  await duzenle.click();
  await page.waitForTimeout(700);

  const YENI = `DUZELTILMIS METIN ${Date.now().toString().slice(-6)}`;
  // Sayfada birden çok metin kutusu var; düzenleme kutusu = değeri mevcut yorumu taşıyan.
  const boxes = page.locator("textarea, input[type=text]");
  const n = await boxes.count();
  let box = null;
  for (let i = 0; i < n; i++) {
    const v = await boxes.nth(i).inputValue().catch(() => "");
    if (v.includes("ILK HALI")) { box = boxes.nth(i); break; }
  }
  expect(box, "düzenleme kutusu mevcut yorum metniyle açılmalı").not.toBeNull();
  await box!.fill(YENI);
  await page.getByText(/^Kaydet$/).first().click();
  await page.waitForTimeout(4000);

  const after = await one<{ comment: string; rating: string }>(
    `select comment, rating::text from reviews where id = '${reviewId}'`
  );
  expect(after!.comment, "düzenleme DB'ye yazılmalı").toBe(YENI);

  await runSql(`delete from reviews where id='${reviewId}'; delete from listings where id='${listingId}';`);
  console.log(`ILAN SAYFASI YORUM DUZENLEME OK: "${after!.comment}"`);
});
