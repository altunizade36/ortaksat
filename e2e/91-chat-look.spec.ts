import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/chat-look";
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  const eb = page.getByText(/E-posta ile giriş yap/i).first();
  if (await eb.count().then((c) => c > 0).catch(() => false)) await eb.click();
  else await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(5500);
}

async function seed() {
  const sellerEmail = uniqueEmail("chatseller");
  const buyerEmail = uniqueEmail("chatbuyer");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "Ahmet Satıcı");
  const buyerId = await createConfirmedUser(buyerEmail, PW, "Mehmet Alıcı");
  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'iPhone 13 128GB Temiz',
            'e2e-chat-' || substr(md5(random()::text),1,8), 'İstanbul', 'temiz', 'Cep Telefonu',
            28000, 'rate', 10, 'active', 1, false, 'open') returning id`);
  const listingId = l!.id;
  const c = await one<{ id: string }>(`insert into conversations
    (id, listing_id, seller_id, buyer_id, participant_ids, status, last_message_at, created_at)
    values (gen_random_uuid(), '${listingId}', '${sellerId}', '${buyerId}',
            array['${sellerId}','${buyerId}']::uuid[], 'open', now(), now()) returning id`);
  const convId = c!.id;
  // Birkaç mesaj (alıcı ↔ satıcı)
  const msgs = [
    [buyerId, sellerId, "Merhaba, iPhone hâlâ satılık mı?"],
    [sellerId, buyerId, "Merhaba, evet satılık. Temiz kullanılmış, kutulu."],
    [buyerId, sellerId, "Pil sağlığı yüzde kaç?"],
    [sellerId, buyerId, "%89. İsterseniz görüntülü de gösterebilirim."],
    [buyerId, sellerId, "Süper, 26.000 olur mu?"]
  ];
  // SIRALI damga (i saniye) — ekranda kronolojik doğrulama için (rastgele damga sırayı bozuyordu).
  for (let i = 0; i < msgs.length; i++) {
    const [s, r, b] = msgs[i];
    await runSql(`insert into messages (id, conversation_id, listing_id, sender_id, receiver_id, body, read, created_at)
      values (gen_random_uuid(), '${convId}', '${listingId}', '${s}', '${r}', '${b.replace(/'/g, "''")}', true, now() + (${i} * interval '1 second'))`);
  }
  return { buyerEmail, convId, listingId, sellerId, buyerId };
}

test("SOHBET görünüm (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const { buyerEmail, convId } = await seed();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await login(page, buyerEmail);
  await page.goto("/messages", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/d-inbox.png`, fullPage: true }).catch(() => {});
  await page.goto(`/chat/${convId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/d-chat.png`, fullPage: true }).catch(() => {});
  await ctx.close();
});

test("SOHBET görünüm (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const { buyerEmail, convId } = await seed();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await login(page, buyerEmail);
  await page.goto("/messages", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/m-inbox.png`, fullPage: true }).catch(() => {});
  await page.goto(`/chat/${convId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/m-chat.png`, fullPage: true }).catch(() => {});

  // MESAJ SIRASI (mobilde kenar çubuğu YOK → her metin yalnız balonda geçer, temiz test):
  // sıralı damgalı 5 mesaj KRONOLOJİK görünmeli.
  const order = await page.evaluate(() => {
    const wanted = ["iPhone hâlâ satılık", "evet satılık", "Pil sağlığı", "görüntülü de", "26.000 olur"];
    const html = document.body.innerText;
    return wanted.map((w) => html.indexOf(w));
  });
  console.log(`mesaj DOM konumları (mobil): ${order.join(", ")}`);
  const sorted = order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1]));
  expect(sorted, "mesajlar kronolojik sırada görünmeli").toBeTruthy();

  await ctx.close();
});
