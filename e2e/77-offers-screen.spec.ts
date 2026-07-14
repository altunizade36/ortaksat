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
  await page.getByText(/E-posta ile giriş yap/i).first().click();
  await page.waitForTimeout(5500);
}

/**
 * TEKLİFLERİM ekranı (/offers): alıcının teklif listesi yoktu. Burada satıcının
 * karşı teklifini ALICI BU EKRANDAN kabul ediyor ve anlaşma tutarını yine SUNUCU
 * yazıyor (istemci tutar göndermez).
 */
test("TEKLİFLERİM: karşı teklif bu ekrandan kabul edilir, tutarı sunucu yazar", async ({ page }) => {
  test.setTimeout(600_000);

  const sellerEmail = uniqueEmail("ofsseller");
  const buyerEmail = uniqueEmail("ofsbuyer");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E OfrSatici");
  const buyerId = await createConfirmedUser(buyerEmail, PW, "E2E OfrAlici");

  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'E2E TEKLIFLERIM URUNU',
            'e2e-ofs-' || substr(md5(random()::text),1,8), 'İstanbul', 'test', 'Cep Telefonu',
            60000, 'rate', 10, 'active', 5, false, 'open')
    returning id`);
  const listingId = l!.id;

  // Alıcı 40.000 teklif etti, satıcı 55.000 karşı teklif verdi (durum kurulumu).
  const o = await one<{ id: string }>(`insert into offers
    (id, listing_id, buyer_id, seller_id, amount, note, status, counter_amount, responded_at, created_at)
    values (gen_random_uuid(), '${listingId}', '${buyerId}', '${sellerId}', 40000, 'e2e',
            'countered', 55000, now(), now())
    returning id`);
  const offerId = o!.id;

  await login(page, buyerEmail);
  await page.goto("/offers", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  await expect(page.getByText(/Süren teklifler/).first(), "süren teklif bölümü").toBeVisible();
  await expect(page.getByText(/Karşı teklif geldi/).first(), "karşı teklif rozeti").toBeVisible();

  await page.getByText(/^Kabul Et$/).first().click();
  await page.waitForTimeout(4500);

  const after = await one<{ status: string; amount: string }>(
    `select status::text, amount::text from offers where id = '${offerId}'`
  );
  expect(after!.status, "/offers ekranından kabul edildi").toBe("accepted");
  expect(Number(after!.amount), "anlaşma tutarını SUNUCU yazdı (40.000 değil 55.000)").toBe(55000);

  await runSql(`delete from offers where id='${offerId}'; delete from listings where id='${listingId}';`);
  console.log("TEKLIFLERIM EKRANI OK: karsi 55000 kabul edildi, son tutar 55000 (sunucu)");
});
