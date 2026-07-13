import { test } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, runSql } from "./helpers/supabase-admin";
const PW = "GucluSifre123!";
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

test("BİLDİRİM: talep gelince satıcı VE ortak bildirim alıyor mu?", async () => {
  test.setTimeout(200000);
  const sEmail = uniqueEmail("ntfs"), pEmail = uniqueEmail("ntfp");
  const sellerId = await createConfirmedUser(sEmail, PW, "S");
  const partnerId = await createConfirmedUser(pEmail, PW, "P");
  const l = await one<{ id: string }>(`insert into listings (id,owner_id,title,slug,location,description,category,price,commission_type,commission_value,status,stock_count,demo,partnership_mode) values (gen_random_uuid(),'${sellerId}','E2E BILDIRIM URUN','e2e-ntf-'||substr(md5(random()::text),1,8),'İstanbul','t','Cep Telefonu',30000,'rate',10,'active',5,false,'open') returning id`);
  const listingId = l!.id;
  const pr = await one<{ id: string }>(`insert into partnerships (id,listing_id,partner_id,ref_code,status) values (gen_random_uuid(),'${listingId}','${partnerId}','NTF-'||substr(md5(random()::text),1,6),'active') returning id`);
  const partnershipId = pr!.id;

  // talep ekle (trigger otomatik bildirim üretmeli)
  await runSql(`insert into leads (id,listing_id,partnership_id,buyer_name,buyer_phone,note,source,intent,status) values (gen_random_uuid(),'${listingId}','${partnershipId}','Test Alici','+905550000000','ilgileniyorum','web','warm','new')`);

  const sellerNtf = await one<Record<string, unknown>>(`select type, title, read from notifications where user_id='${sellerId}' order by created_at desc limit 1`);
  const partnerNtf = await one<Record<string, unknown>>(`select type, title, read from notifications where user_id='${partnerId}' order by created_at desc limit 1`);
  console.log(`SATICI bildirimi: ${sellerNtf ? JSON.stringify(sellerNtf) : "!! YOK ✗"}`);
  console.log(`ORTAK bildirimi:  ${partnerNtf ? JSON.stringify(partnerNtf) : "!! YOK ✗"}`);
  console.log(`→ Satıcı bildirildi mi: ${sellerNtf?.type === "lead" ? "DOĞRU ✓" : "✗"}`);
  console.log(`→ Ortak bildirildi mi:  ${partnerNtf ? "DOĞRU ✓" : "✗"}`);
});
