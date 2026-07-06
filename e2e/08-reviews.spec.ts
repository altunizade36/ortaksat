import { test, expect } from "@playwright/test";
import {
  apiSignInToken,
  createConfirmedUser,
  restInsertAsUser,
  runSql,
  seedListing,
  uniqueEmail
} from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

// Karşılıklı satış puanlaması: gerçek istemci (RLS) yolundan yorum yazılınca
// (a) sale_id/reviewed_user_id kalıcı olur, (b) tetikleyici puanlanan kullanıcının
// profiles.rating'ini yeniden hesaplar. Bu, uygulamadaki insertReview'ın izlediği
// yolun BİREBİR aynısıdır (supabase-js kullanıcı oturumuyla POST eder).
test("karşılıklı puanlama: RLS altında yorum yazılır, alınan puan ortalaması güncellenir", async () => {
  const sellerEmail = uniqueEmail("rev-seller");
  const p1Email = uniqueEmail("rev-p1");
  const p2Email = uniqueEmail("rev-p2");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E Yorum Satici");
  const p1 = await createConfirmedUser(p1Email, PW, "E2E Yorum Ortak1");
  const p2 = await createConfirmedUser(p2Email, PW, "E2E Yorum Ortak2");
  const listingId = await seedListing(sellerId);

  // Ortak 1, satıcıyı 5 ile puanlar (satış sonrası "seller" tipi yorum).
  const t1 = await apiSignInToken(p1Email, PW);
  expect(t1, "ortak1 token almalı").toBeTruthy();
  const r1 = await restInsertAsUser(t1!, "reviews", {
    listing_id: listingId,
    reviewer_id: p1,
    rating: 5,
    comment: "Satıcı çok hızlı ve güvenilirdi, komisyon zamanında ödendi.",
    type: "seller",
    reviewed_user_id: sellerId
  });
  expect(r1.ok, `yorum1 eklenmeli (RLS): ${r1.status} ${r1.body}`).toBeTruthy();

  // Tetikleyici: satıcının puanı 5.0 olmalı.
  let rating = await runSql<Array<{ rating: string }>>(`select rating from profiles where id='${sellerId}';`);
  expect(Number(rating[0].rating), "tek 5'lik yorumdan sonra puan 5.0").toBe(5);

  // Yorum sale/kullanıcı bağlarıyla kalıcı olmalı (yeniden yükleme sonrası da doğru).
  const stored = await runSql<Array<{ reviewed_user_id: string; type: string }>>(
    `select reviewed_user_id, type from reviews where reviewer_id='${p1}' and listing_id='${listingId}';`
  );
  expect(stored[0]?.reviewed_user_id, "reviewed_user_id kalıcı olmalı").toBe(sellerId);
  expect(stored[0]?.type).toBe("seller");

  // Ortak 2, satıcıyı 4 ile puanlar → ortalama 4.5 olmalı.
  const t2 = await apiSignInToken(p2Email, PW);
  const r2 = await restInsertAsUser(t2!, "reviews", {
    listing_id: listingId,
    reviewer_id: p2,
    rating: 4,
    comment: "İletişim iyiydi, ürün açıklandığı gibiydi.",
    type: "seller",
    reviewed_user_id: sellerId
  });
  expect(r2.ok, `yorum2 eklenmeli: ${r2.status} ${r2.body}`).toBeTruthy();
  rating = await runSql<Array<{ rating: string }>>(`select rating from profiles where id='${sellerId}';`);
  expect(Number(rating[0].rating), "5 ve 4 ortalaması 4.5").toBe(4.5);
});

// Mağaza sayfası ziyaretçiye satıcının ALDIĞI gerçek değerlendirmeleri gösterir
// (global store yalnız giriş yapan kullanıcının YAZDIĞI yorumları tutuyordu;
// fetchReviewsForUser bu boşluğu doldurur).
test("mağaza sayfası satıcının aldığı yorumları gösterir", async ({ page }) => {
  const sellerEmail = uniqueEmail("rev-store");
  const buyerEmail = uniqueEmail("rev-buyer");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E Magaza Satici");
  const buyerId = await createConfirmedUser(buyerEmail, PW, "E2E Magaza Alici");
  const listingId = await seedListing(sellerId, "E2E Magaza Ürünü");

  const marker = `E2E-YORUM-${Date.now()}`;
  const token = await apiSignInToken(buyerEmail, PW);
  const r = await restInsertAsUser(token!, "reviews", {
    listing_id: listingId,
    reviewer_id: buyerId,
    rating: 5,
    comment: `${marker} — satıcı harikaydı, kesinlikle tavsiye ederim.`,
    type: "seller",
    reviewed_user_id: sellerId
  });
  expect(r.ok, `yorum eklenmeli: ${r.status} ${r.body}`).toBeTruthy();

  await page.goto(`/store/${sellerId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  // "Yorumlar" sekmesine geç.
  await page.getByText(/Yorumlar/i).first().click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/store-reviews.png", fullPage: true });
  await expect(page.getByText(new RegExp(marker)).first()).toBeVisible({ timeout: 15_000 });
});
