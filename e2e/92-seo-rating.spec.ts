import { test, expect } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, runSql } from "./helpers/supabase-admin";

const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];
const BASE = "https://www.ortaksat.com";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** Googlebot olarak ilan HTML'ini çeker (middleware bu UA'ya zengin meta döndürür). */
async function fetchAsBot(path: string): Promise<string> {
  const r = await fetch(`${BASE}${path}`, { headers: { "user-agent": GOOGLEBOT } });
  return r.text();
}

/**
 * SEO YAPILANDIRILMIŞ VERİ (Google Search Console "aggregateRating/review eksik"):
 * - GERÇEK yorumu olan ilan → Product JSON-LD'de aggregateRating + review ÇIKAR.
 * - Yorumu olmayan ilan → aggregateRating/review EKLENMEZ (sahte veri yasağı).
 */
test("SEO: gerçek yorumda aggregateRating+review çıkar, yorumsuzda çıkmaz", async () => {
  test.setTimeout(200_000);

  const sellerEmail = uniqueEmail("seoseller");
  const buyerEmail = uniqueEmail("seobuyer");
  const sellerId = await createConfirmedUser(sellerEmail, "GucluSifre123!", "Ayşe Satıcı");
  const buyerId = await createConfirmedUser(buyerEmail, "GucluSifre123!", "Veli Alıcı");

  // İki ilan: biri yorumlu, biri yorumsuz
  const mk = async (title: string) => (await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', '${title}', 'e2e-seo-' || substr(md5(random()::text),1,8),
            'İstanbul', 'Temiz ürün, detaylar için mesaj.', 'Cep Telefonu', 20000, 'rate', 10, 'active', 1, false, 'open')
    returning id`))!.id;
  const withRev = await mk("E2E SEO Yorumlu Urun");
  const noRev = await mk("E2E SEO Yorumsuz Urun");

  // GERÇEK yorum ekle (yorumlu ilana)
  await runSql(`insert into reviews (id, listing_id, reviewer_id, reviewed_user_id, rating, comment, type, helpful_count, created_at)
    values (gen_random_uuid(), '${withRev}', '${buyerId}', '${sellerId}', 5, 'Ürün birebir açıklandığı gibi, satıcı çok ilgili.', 'product', 0, now())`);

  // review_count view'a yansıdı mı?
  const rc = await one<{ c: string }>(`select review_count::text c from listing_public_cards where id='${withRev}'`);
  console.log(`yorumlu ilan review_count = ${rc?.c}`);

  // 1) YORUMLU ilan (Googlebot) → aggregateRating + review olmalı
  const htmlWith = await fetchAsBot(`/listing/${withRev}`);
  const ld = htmlWith.match(/"@type":\s*"Product"[\s\S]*?<\/script>/)?.[0] ?? htmlWith;
  console.log(`yorumlu: aggregateRating=${ld.includes("AggregateRating")} review=${ld.includes('"Review"')} ratingValue=${/ratingValue/.test(ld)}`);
  expect(ld.includes("AggregateRating"), "yorumlu ilanda aggregateRating olmalı").toBeTruthy();
  expect(ld.includes('"Review"') || ld.includes('"@type":"Review"'), "yorumlu ilanda review olmalı").toBeTruthy();
  expect(ld.includes("Ürün birebir açıklandığı gibi") || ld.includes("birebir"), "gerçek yorum metni olmalı").toBeTruthy();

  // 2) YORUMSUZ ilan → aggregateRating/review OLMAMALI (sahte veri yok)
  const htmlNo = await fetchAsBot(`/listing/${noRev}`);
  const ldNo = htmlNo.match(/"@type":\s*"Product"[\s\S]*?<\/script>/)?.[0] ?? "";
  console.log(`yorumsuz: aggregateRating=${ldNo.includes("AggregateRating")}`);
  expect(ldNo.includes("AggregateRating"), "yorumsuz ilanda sahte aggregateRating OLMAMALI").toBeFalsy();
  // ama fiyat/Offer yine olmalı (zengin sonuç korunur)
  expect(htmlNo.includes('"Offer"') || htmlNo.includes("Offer"), "yorumsuzda da Offer/fiyat olmalı").toBeTruthy();

  console.log("SEO RATING OK");
  await runSql(`delete from reviews where listing_id='${withRev}'; delete from listings where id in ('${withRev}','${noRev}');`);
});
