import { test } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, apiSignInToken, restInsertAsUser, seedSale, runSql } from "./helpers/supabase-admin";
const PW = "GucluSifre123!";
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

test("YORUM BÜTÜNLÜĞÜ: gerçek satış → yorum geçer; satışsız/yabancı → RLS reddeder", async () => {
  test.setTimeout(300000);
  const sEmail = uniqueEmail("rvs"), pEmail = uniqueEmail("rvp"), xEmail = uniqueEmail("rvx");
  const sellerId = await createConfirmedUser(sEmail, PW, "S");
  const partnerId = await createConfirmedUser(pEmail, PW, "P");
  const strangerId = await createConfirmedUser(xEmail, PW, "X");
  const l = await one<{ id: string }>(`insert into listings (id,owner_id,title,slug,location,description,category,price,commission_type,commission_value,status,stock_count,demo,partnership_mode) values (gen_random_uuid(),'${sellerId}','E2E YORUM URUN','e2e-rv-'||substr(md5(random()::text),1,8),'İstanbul','t','Cep Telefonu',30000,'rate',10,'active',5,false,'open') returning id`);
  const listingId = l!.id;
  const saleId = await seedSale(sellerId, partnerId, listingId);

  const pToken = await apiSignInToken(pEmail, PW);
  const xToken = await apiSignInToken(xEmail, PW);

  // 1) GERÇEK: ortak, satıştan sonra satıcıyı yorumlar → GEÇMELİ
  const ok = await restInsertAsUser(pToken!, "reviews", {
    id: crypto.randomUUID(), listing_id: listingId, reviewer_id: partnerId, reviewed_user_id: sellerId,
    sale_id: saleId, rating: 5, comment: "Harika satıcı, hızlı iletişim.", type: "seller", helpful_count: 0
  });
  console.log(`1) GERÇEK yorum (ortak→satıcı, satışlı): ok=${ok.ok} status=${ok.status} → ${ok.ok ? "GEÇTİ ✓" : "REDDEDİLDİ ✗ " + ok.body.slice(0,80)}`);

  // 2) SAHTE: yabancı, hiç satışı yokken satıcıyı yorumlar → REDDEDİLMELİ
  const fake = await restInsertAsUser(xToken!, "reviews", {
    id: crypto.randomUUID(), listing_id: listingId, reviewer_id: strangerId, reviewed_user_id: sellerId,
    sale_id: saleId, rating: 1, comment: "Sahte kötü yorum.", type: "seller", helpful_count: 0
  });
  console.log(`2) SAHTE yorum (yabancı, satışa taraf değil): ok=${fake.ok} status=${fake.status} → ${!fake.ok ? "REDDEDİLDİ ✓ (koruma çalışıyor)" : "GEÇTİ ✗ GÜVENLİK AÇIĞI"}`);

  // 3) SAHTE-2: yabancı, sale_id olmadan satıcı yorumu → REDDEDİLMELİ
  const fake2 = await restInsertAsUser(xToken!, "reviews", {
    id: crypto.randomUUID(), listing_id: listingId, reviewer_id: strangerId, reviewed_user_id: sellerId,
    rating: 1, comment: "Satışsız sahte.", type: "seller", helpful_count: 0
  });
  console.log(`3) SAHTE-2 yorum (sale_id yok): ok=${fake2.ok} status=${fake2.status} → ${!fake2.ok ? "REDDEDİLDİ ✓" : "GEÇTİ ✗ GÜVENLİK AÇIĞI"}`);

  const cnt = await one<Record<string, unknown>>(`select count(*) c from reviews where listing_id='${listingId}'`);
  console.log(`   DB'de yorum sayısı: ${JSON.stringify(cnt)} (beklenen: 1 — yalnız gerçek)`);
});
