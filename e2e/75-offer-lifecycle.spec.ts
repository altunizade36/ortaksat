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
async function logout(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ } });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
}

/**
 * TEKLİF YAŞAM DÖNGÜSÜ (uçtan uca, canlıya karşı):
 *   alıcı teklif verir → satıcı KARŞI TEKLİF verir → alıcı kabul eder
 * Her adım DB'den doğrulanır. Kritik iddia: anlaşma tutarını SUNUCU yazar —
 * alıcı kabul edince amount = counter_amount olur, istemci tutar gönderemez.
 */
test("TEKLİF: ver → karşı teklif → kabul (tutarı sunucu yazar)", async ({ page }) => {
  test.setTimeout(900_000);

  const sellerEmail = uniqueEmail("ofrseller");
  const buyerEmail = uniqueEmail("ofrbuyer");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E TeklifSatici");
  const buyerId = await createConfirmedUser(buyerEmail, PW, "E2E TeklifAlici");

  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'E2E TEKLIF URUNU',
            'e2e-ofr-' || substr(md5(random()::text),1,8), 'İstanbul', 'test', 'Cep Telefonu',
            100000, 'rate', 10, 'active', 5, false, 'open')
    returning id`);
  const listingId = l!.id;

  // 1) ALICI teklif verir: 80.000
  await login(page, buyerEmail);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.getByText(/^Teklif Ver$/).first().tap();
  await page.waitForTimeout(800);
  await page.getByPlaceholder(/Örn\. 45\.000/).fill("80000");
  await page.getByPlaceholder(/Nakit alırım/).fill("E2E teklif notu");
  await page.getByText(/Teklifi Gönder/).first().tap();
  await page.waitForTimeout(4000);

  const o1 = await one<{ id: string; status: string; amount: string }>(
    `select id, status::text, amount::text from offers where listing_id = '${listingId}' and buyer_id = '${buyerId}'`
  );
  expect(o1, "teklif DB'ye yazılmalı").toBeTruthy();
  expect(o1!.status).toBe("pending");
  expect(Number(o1!.amount)).toBe(80000);
  const offerId = o1!.id;

  const n1 = await one<{ c: string }>(
    `select count(*)::text c from notifications where user_id = '${sellerId}' and type = 'offer'`
  );
  expect(Number(n1!.c), "satıcıya teklif bildirimi").toBeGreaterThan(0);

  // 2) SATICI karşı teklif verir: 90.000
  await logout(page);
  await login(page, sellerEmail);
  await page.goto("/seller", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.getByText(/Karşı Teklif/).first().tap();
  await page.waitForTimeout(700);
  await page.getByPlaceholder("100000").fill("90000");
  await page.getByText(/^Gönder$/).first().tap();
  await page.waitForTimeout(4000);

  const o2 = await one<{ status: string; counter_amount: string }>(
    `select status::text, counter_amount::text from offers where id = '${offerId}'`
  );
  expect(o2!.status, "satıcı karşı teklif verdi").toBe("countered");
  expect(Number(o2!.counter_amount)).toBe(90000);

  // 3) ALICI karşı teklifi kabul eder → tutarı SUNUCU yazar (90.000)
  await logout(page);
  await login(page, buyerEmail);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByTestId("offer-accept-counter").tap();
  await page.waitForTimeout(4000);

  const o3 = await one<{ status: string; amount: string }>(
    `select status::text, amount::text from offers where id = '${offerId}'`
  );
  expect(o3!.status, "alıcı karşı teklifi kabul etti").toBe("accepted");
  expect(Number(o3!.amount), "anlaşma tutarını SUNUCU yazdı (80.000 değil 90.000)").toBe(90000);

  const n2 = await one<{ c: string }>(
    `select count(*)::text c from notifications
     where user_id = '${sellerId}' and type = 'offer' and title like 'Karşı teklifin%'`
  );
  expect(Number(n2!.c), "satıcı, karşı teklifinin kabul edildiğini öğrenir").toBeGreaterThan(0);

  // 4) SATICI panelinde "Anlaşmalar" görünür (kabul edilen teklif kaybolmuyor)
  await logout(page);
  await login(page, sellerEmail);
  await page.goto("/seller", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await expect(page.getByText(/Anlaşmalar/).first()).toBeVisible();
  await expect(page.getByText(/Alıcıyla mesajlaş/).first()).toBeVisible();

  await runSql(`delete from offers where id = '${offerId}'; delete from listings where id = '${listingId}';`);
  console.log("TEKLIF E2E OK: 80000 → karsi 90000 → kabul, son tutar 90000 (sunucu)");
});
