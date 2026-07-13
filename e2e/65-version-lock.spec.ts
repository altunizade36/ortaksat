import { test } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, runSql } from "./helpers/supabase-admin";
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];
const PW = "GucluSifre123!";

test("İLAN SÜRÜM KİLİDİ: ortak katıldıktan sonra satıcı komisyonu değişince mevcut ortağın şartı KİLİTLİ kalır", async () => {
  test.setTimeout(200000);
  const sEmail = uniqueEmail("vls"), pEmail = uniqueEmail("vlp");
  const sellerId = await createConfirmedUser(sEmail, PW, "S");
  const partnerId = await createConfirmedUser(pEmail, PW, "P");

  // 1) İlan %10 komisyonla
  const l = await one<{ id: string }>(`insert into listings (id,owner_id,title,slug,location,description,category,price,commission_type,commission_value,status,stock_count,demo,partnership_mode) values (gen_random_uuid(),'${sellerId}','E2E KILIT URUN','e2e-vl-'||substr(md5(random()::text),1,8),'İstanbul','t','Cep Telefonu',100000,'rate',10,'active',5,false,'open') returning id`);
  const listingId = l!.id;

  // 2) Ortak katılır (active → agreed KİLİTLENİR trigger ile)
  const pr = await one<{ id: string }>(`insert into partnerships (id,listing_id,partner_id,ref_code,status) values (gen_random_uuid(),'${listingId}','${partnerId}','VL-'||substr(md5(random()::text),1,6),'active') returning id`);
  const partnershipId = pr!.id;
  const locked = await one<Record<string, unknown>>(`select agreed_commission_type, agreed_commission_value, agreed_at from partnerships where id='${partnershipId}'`);
  console.log(`1) KATILIM → kilitlenen şart: ${JSON.stringify(locked)}`);
  console.log(`   %10 kilitlendi mi → ${String(locked?.agreed_commission_value) === "10.00" && locked?.agreed_at ? "DOĞRU ✓" : "✗"}`);

  // 3) Satıcı ilanı %5'e DÜŞÜRÜR
  await runSql(`update listings set commission_value=5 where id='${listingId}'`);
  const nowListing = await one<Record<string, unknown>>(`select commission_value from listings where id='${listingId}'`);
  console.log(`2) SATICI İNDİRDİ → ilan artık %${nowListing?.commission_value}`);

  // 4) agreed_* HÂLÂ %10 mu? (sürüm kilidi)
  const still = await one<Record<string, unknown>>(`select agreed_commission_value from partnerships where id='${partnershipId}'`);
  console.log(`3) KİLİT → mevcut ortağın agreed_commission hâlâ: %${still?.agreed_commission_value}`);
  console.log(`   → ${String(still?.agreed_commission_value) === "10.00" ? "KİLİTLİ KALDI ✓ (ortak korundu)" : "BOZULDU ✗"}`);

  // 5) SUNUCU hesabı: 100.000 satışta komisyon KİLİTLİ %10 = 10.000 mu, yoksa yeni %5 = 5.000 mu?
  const calc = await one<Record<string, unknown>>(`select public.compute_agreed_commission('${partnershipId}'::uuid, 100000, 1, 0) as commission`);
  console.log(`4) SUNUCU HESABI → 100.000₺ satışta komisyon: ${JSON.stringify(calc)}`);
  console.log(`   → ${String(calc?.commission) === "10000" ? "10.000 = KİLİTLİ %10 ✓ (satıcı düşürse de ortak %10 alır)" : "YANLIŞ ✗ " + JSON.stringify(calc)}`);
});

test("SÜRÜM KİLİDİ ortak-başına: değişiklikten SONRA katılan yeni ortak YENİ oranı alır", async () => {
  test.setTimeout(200000);
  const sEmail = uniqueEmail("vl2s"), p1Email = uniqueEmail("vl2a"), p2Email = uniqueEmail("vl2b");
  const sellerId = await createConfirmedUser(sEmail, PW, "S");
  const p1 = await createConfirmedUser(p1Email, PW, "P1");
  const p2 = await createConfirmedUser(p2Email, PW, "P2");
  const l = await one<{ id: string }>(`insert into listings (id,owner_id,title,slug,location,description,category,price,commission_type,commission_value,status,stock_count,demo,partnership_mode) values (gen_random_uuid(),'${sellerId}','E2E KILIT2','e2e-vl2-'||substr(md5(random()::text),1,8),'İstanbul','t','Cep Telefonu',100000,'rate',10,'active',5,false,'open') returning id`);
  const listingId = l!.id;
  // ortak1 %10'da katılır
  const pa = await one<{ id: string }>(`insert into partnerships (id,listing_id,partner_id,ref_code,status) values (gen_random_uuid(),'${listingId}','${p1}','A-'||substr(md5(random()::text),1,6),'active') returning id`);
  // satıcı %5'e düşürür
  await runSql(`update listings set commission_value=5 where id='${listingId}'`);
  // ortak2 ŞİMDİ katılır → %5 kilitlenmeli
  const pb = await one<{ id: string }>(`insert into partnerships (id,listing_id,partner_id,ref_code,status) values (gen_random_uuid(),'${listingId}','${p2}','B-'||substr(md5(random()::text),1,6),'active') returning id`);
  const c1 = await one<Record<string, unknown>>(`select public.compute_agreed_commission('${pa!.id}'::uuid, 100000, 1, 0) as c`);
  const c2 = await one<Record<string, unknown>>(`select public.compute_agreed_commission('${pb!.id}'::uuid, 100000, 1, 0) as c`);
  console.log(`ortak1 (önce katıldı, %10 kilit) → komisyon: ${JSON.stringify(c1)} → ${String(c1?.c)==="10000"?"10.000 ✓":"✗"}`);
  console.log(`ortak2 (sonra katıldı, %5 kilit)  → komisyon: ${JSON.stringify(c2)} → ${String(c2?.c)==="5000"?"5.000 ✓ (ortak-başına izolasyon)":"✗ "+JSON.stringify(c2)}`);
});
