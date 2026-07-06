import { test, expect } from "@playwright/test";
import {
  apiSignInToken,
  createConfirmedUser,
  restInsertAsUser,
  runSql,
  seedListing,
  seedSale,
  uniqueEmail
} from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

// Karşılıklı satış puanlaması: GERÇEK bir satış (commission) üzerinden, RLS altında
// yorum yazılınca (a) sale_id/reviewed_user_id kalıcı, (b) tetikleyici puanlanan
// kullanıcının profiles.rating'ini yeniden hesaplar. insertReview'ın yoludur.
test("karşılıklı puanlama: gerçek satışta yorum yazılır, alınan puan ortalaması güncellenir", async () => {
  const sellerEmail = uniqueEmail("rev-seller");
  const p1Email = uniqueEmail("rev-p1");
  const p2Email = uniqueEmail("rev-p2");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E Yorum Satici");
  const p1 = await createConfirmedUser(p1Email, PW, "E2E Yorum Ortak1");
  const p2 = await createConfirmedUser(p2Email, PW, "E2E Yorum Ortak2");
  const listingId = await seedListing(sellerId);
  const sale1 = await seedSale(sellerId, p1, listingId);
  const sale2 = await seedSale(sellerId, p2, listingId);

  // Ortak 1, gerçek satışı üzerinden satıcıyı 5 ile puanlar.
  const t1 = await apiSignInToken(p1Email, PW);
  expect(t1, "ortak1 token almalı").toBeTruthy();
  const r1 = await restInsertAsUser(t1!, "reviews", {
    listing_id: listingId,
    reviewer_id: p1,
    rating: 5,
    comment: "Satıcı çok hızlı ve güvenilirdi, komisyon zamanında ödendi.",
    type: "seller",
    reviewed_user_id: sellerId,
    sale_id: sale1
  });
  expect(r1.ok, `yorum1 eklenmeli (RLS): ${r1.status} ${r1.body}`).toBeTruthy();

  let rating = await runSql<Array<{ rating: string }>>(`select rating from profiles where id='${sellerId}';`);
  expect(Number(rating[0].rating), "tek 5'lik yorumdan sonra puan 5.0").toBe(5);

  const stored = await runSql<Array<{ reviewed_user_id: string; type: string; sale_id: string }>>(
    `select reviewed_user_id, type, sale_id from reviews where reviewer_id='${p1}' and listing_id='${listingId}';`
  );
  expect(stored[0]?.reviewed_user_id, "reviewed_user_id kalıcı").toBe(sellerId);
  expect(stored[0]?.sale_id, "sale_id kalıcı").toBe(sale1);

  // Ortak 2, kendi satışı üzerinden 4 → ortalama 4.5.
  const t2 = await apiSignInToken(p2Email, PW);
  const r2 = await restInsertAsUser(t2!, "reviews", {
    listing_id: listingId, reviewer_id: p2, rating: 4,
    comment: "İletişim iyiydi, ürün açıklandığı gibiydi.", type: "seller", reviewed_user_id: sellerId, sale_id: sale2
  });
  expect(r2.ok, `yorum2 eklenmeli: ${r2.status} ${r2.body}`).toBeTruthy();
  rating = await runSql<Array<{ rating: string }>>(`select rating from profiles where id='${sellerId}';`);
  expect(Number(rating[0].rating), "5 ve 4 ortalaması 4.5").toBe(4.5);
});

// GÜVENLİK: satışı OLMAYAN bir kullanıcı başka biri hakkında seller/partner yorumu
// YAZAMAZ (bot ile puan manipülasyonu engeli). RLS reddetmeli.
test("güvenlik: gerçek satış olmadan puanlama RLS ile reddedilir", async () => {
  const victimEmail = uniqueEmail("rev-victim");
  const attackerEmail = uniqueEmail("rev-attacker");
  const victimId = await createConfirmedUser(victimEmail, PW, "E2E Kurban Satici");
  const attackerId = await createConfirmedUser(attackerEmail, PW, "E2E Saldirgan");
  const listingId = await seedListing(victimId, "E2E Kurban Ürünü");

  const before = await runSql<Array<{ rating: string }>>(`select rating from profiles where id='${victimId}';`);

  const token = await apiSignInToken(attackerEmail, PW);
  // Satış yok, sale_id yok → 1 yıldızlı sahte yorumla puan düşürme girişimi.
  const attack = await restInsertAsUser(token!, "reviews", {
    listing_id: listingId, reviewer_id: attackerId, rating: 1,
    comment: "Sahte kötüleme.", type: "seller", reviewed_user_id: victimId
  });
  expect(attack.ok, "satışsız sahte yorum RLS ile REDDEDİLMELİ").toBeFalsy();
  expect(attack.status, "RLS ihlali 401/403 döner").toBeGreaterThanOrEqual(401);

  const after = await runSql<Array<{ rating: string }>>(`select rating from profiles where id='${victimId}';`);
  expect(after[0].rating, "kurbanın puanı DEĞİŞMEMELİ").toBe(before[0].rating);
});

// Mağaza sayfası ziyaretçiye satıcının ALDIĞI gerçek değerlendirmeleri gösterir.
test("mağaza sayfası satıcının aldığı yorumları gösterir", async ({ page }) => {
  const sellerEmail = uniqueEmail("rev-store");
  const partnerEmail = uniqueEmail("rev-storep");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E Magaza Satici");
  const partnerId = await createConfirmedUser(partnerEmail, PW, "E2E Magaza Ortak");
  const listingId = await seedListing(sellerId, "E2E Magaza Ürünü");
  const sale = await seedSale(sellerId, partnerId, listingId);

  const marker = `E2E-YORUM-${Date.now()}`;
  const token = await apiSignInToken(partnerEmail, PW);
  const r = await restInsertAsUser(token!, "reviews", {
    listing_id: listingId, reviewer_id: partnerId, rating: 5,
    comment: `${marker} — satıcı harikaydı, kesinlikle tavsiye ederim.`, type: "seller", reviewed_user_id: sellerId, sale_id: sale
  });
  expect(r.ok, `yorum eklenmeli: ${r.status} ${r.body}`).toBeTruthy();

  await page.goto(`/store/${sellerId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByText(/Yorumlar/i).first().click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/store-reviews.png", fullPage: true });
  await expect(page.getByText(new RegExp(marker)).first()).toBeVisible({ timeout: 15_000 });
});
