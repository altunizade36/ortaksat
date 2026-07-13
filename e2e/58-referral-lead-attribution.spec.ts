import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });

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
  // ÖNCE bir sayfa aç (about:blank'te localStorage erişimi SecurityError verir), SONRA temizle.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* yok say */ } });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
}
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

/**
 * ÜRÜNÜN KALBİ: "doğrulanabilir yönlendirme".
 * Ortak linki paylaşır → ALICI (giriş YOK) linkten gelir → talep bırakır →
 * talep O ORTAĞA atfedilir → satıcı talebi satışa çevirir → komisyon o ortağa yazılır.
 */
test("REFERANS → TALEP → ATIF → SATIŞ: komisyon doğru ortağa yazılıyor mu?", async ({ page }) => {
  test.setTimeout(900_000);
  page.on("dialog", (d) => d.accept().catch(() => {}));

  const sellerEmail = uniqueEmail("rfseller");
  const p1Email = uniqueEmail("rfp1");
  const p2Email = uniqueEmail("rfp2");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E RefSatici");
  const p1Id = await createConfirmedUser(p1Email, PW, "E2E OrtakBir");
  const p2Id = await createConfirmedUser(p2Email, PW, "E2E OrtakIki");

  const l = await one<{ id: string; slug: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'E2E REFERANS URUNU',
            'e2e-ref-' || substr(md5(random()::text),1,8), 'İstanbul', 'test', 'Cep Telefonu',
            80000, 'rate', 15, 'active', 5, false, 'open')
    returning id, slug`);
  const listingId = l!.id, slug = l!.slug;

  // İKİ ortak da aynı ilana ortak olsun (atıf doğru ortağa mı gidiyor, ayırt edelim)
  await runSql(`insert into partnerships (id, listing_id, partner_id, status, ref_code)
    values (gen_random_uuid(), '${listingId}', '${p1Id}', 'active', 'REF-BIR-' || substr(md5(random()::text),1,6)),
           (gen_random_uuid(), '${listingId}', '${p2Id}', 'active', 'REF-IKI-' || substr(md5(random()::text),1,6))`);
  const part1 = await one<{ id: string; ref_code: string }>(`select id, ref_code from partnerships where listing_id='${listingId}' and partner_id='${p1Id}'`);
  const part2 = await one<{ id: string; ref_code: string }>(`select id, ref_code from partnerships where listing_id='${listingId}' and partner_id='${p2Id}'`);
  console.log(`\nilan=${slug} | ortak1 ref=${part1!.ref_code} | ortak2 ref=${part2!.ref_code}`);

  // Referans linki public tabloda var mı?
  const link = await one<Record<string, unknown>>(`select ref_code, slug from referral_public_links where partnership_id='${part1!.id}'`);
  console.log(`1) LİNK     → referral_public_links: ${link ? "VAR ✓" : "!! YOK — ortak link paylaşamaz"}`);

  // ========== 2) ALICI (GİRİŞ YOK) ortak-1'in linkinden gelir ==========
  await logout(page);
  const refUrl = `/i/${slug}?ref=${part1!.ref_code}`;
  await page.goto(refUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "e2e-artifacts/rf-1-landing.png" });
  const landing = await page.locator("body").innerText();
  console.log(`2) LANDING  → ürün görünüyor mu: ${/E2E REFERANS URUNU/i.test(landing) ? "EVET ✓" : "HAYIR ✗"}`);

  // tıklama kaydı düştü mü?
  const clicks = await runSql<Array<Record<string, unknown>>>(`select count(*) c from referral_clicks where partnership_id='${part1!.id}'`);
  console.log(`   tıklama kaydı: ${JSON.stringify(clicks)}`);

  // ========== 3) ALICI TALEP BIRAKIR (giriş yok) ==========
  // NOT: bu formdaki alanlarda placeholder YOK (etiket üstte) → sıraya göre doldur.
  const inputs = page.locator("input");
  const n = await inputs.count();
  console.log(`3) TALEP    → sayfadaki giriş alanı sayısı: ${n}`);
  // header'daki arama kutusunu atla: görünür + form içindeki ilk iki alan
  const formInputs: number[] = [];
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const ph = (await el.getAttribute("placeholder")) ?? "";
    if (/ara|search/i.test(ph)) continue;
    formInputs.push(i);
  }
  console.log(`   form alanı indeksleri: ${JSON.stringify(formInputs)}`);
  if (formInputs.length >= 2) {
    await inputs.nth(formInputs[0]).fill("Test Alici").catch(() => {});
    await inputs.nth(formInputs[1]).fill("+905551234567").catch(() => {});
  } else console.log("   !! talep formu alanları bulunamadı");
  await page.waitForTimeout(500);
  await page.getByText(/Satıcıya Talep Gönder|Talep Gönder/i).first().tap({ timeout: 8000 }).catch((e) => console.log("  talep tap hata: " + e.message.slice(0, 40)));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "e2e-artifacts/rf-2-talep.png" });

  const lead = await one<Record<string, unknown>>(`select id, partnership_id, buyer_name, status from leads where listing_id='${listingId}'`);
  console.log(`   DB TALEP: ${lead ? JSON.stringify(lead) : "!! TALEP OLUŞMADI"}`);
  if (!lead) return;
  const dogruOrtak = lead.partnership_id === part1!.id;
  console.log(`   ATIF: talep ORTAK-1'e mi yazıldı? → ${dogruOrtak ? "DOĞRU ✓" : `YANLIŞ ✗ (ortak2=${part2!.id})`}`);

  // ========== 4) SATICI talebi SATIŞA çevirir ==========
  await login(page, sellerEmail);
  await page.goto("/seller", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: "e2e-artifacts/rf-3-satici.png" });
  const body = await page.locator("body").innerText();
  console.log(`4) SATICI   → talep panelde görünüyor mu: ${/Test Alici/i.test(body) ? "EVET ✓" : "HAYIR ✗"}`);

  const satisaCevir = page.getByText(/Satışa çevir|Satış ekle|Talep \/ randevu kaydet|Doğrulanan satış/i).first();
  console.log(`   "satışa çevir" butonu: ${(await satisaCevir.count()) > 0 ? "VAR ✓" : "YOK ✗"}`);
  await satisaCevir.scrollIntoViewIfNeeded().catch(() => {});
  await satisaCevir.tap({ timeout: 10000 }).catch((e) => console.log("  tap hata: " + e.message.slice(0, 40)));
  await page.waitForTimeout(2500);
  for (const inp of await page.locator("input").all()) {
    if (!(await inp.isVisible().catch(() => false))) continue;
    if (!(await inp.inputValue().catch(() => "x"))) await inp.fill("80000").catch(() => {});
  }
  await page.getByText(/^(Kaydet|Onayla|Satışı Kaydet|Ekle)/).first().tap({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(6000);

  // ========== 5) KOMİSYON DOĞRU ORTAĞA MI? ==========
  const c = await one<Record<string, unknown>>(
    `select c.id, c.partnership_id, c.amount, c.status, c.lead_id, p.partner_id
       from commissions c join partnerships p on p.id = c.partnership_id
      where c.listing_id='${listingId}'`
  );
  console.log(`5) KOMİSYON → ${c ? JSON.stringify(c) : "!! KOMİSYON OLUŞMADI"}`);
  if (!c) return;
  const komisyonDogruOrtak = c.partner_id === p1Id;
  const tutarDogru = String(c.amount) === "12000.00"; // 80.000 × %15
  console.log(`   komisyon ORTAK-1'e mi yazıldı? → ${komisyonDogruOrtak ? "DOĞRU ✓" : "YANLIŞ ✗"}`);
  console.log(`   tutar 80.000 × %15 = 12.000 → ${tutarDogru ? "DOĞRU ✓" : `YANLIŞ ✗ (${c.amount})`}`);
  console.log(`   talebe bağlandı mı (lead_id)? → ${c.lead_id === lead.id ? "DOĞRU ✓" : `bağlanmadı (${c.lead_id})`}`);

  // ========== 6) ORTAK-2 HAKSIZ KOMİSYON ALMADI ==========
  const c2 = await one<Record<string, unknown>>(`select count(*) c from commissions where partnership_id='${part2!.id}'`);
  console.log(`6) ADALET   → ortak-2'nin komisyonu: ${JSON.stringify(c2)} → ${String((c2 as Record<string, unknown>).c) === "0" ? "DOĞRU ✓ (haksız kredi yok)" : "YANLIŞ ✗"}`);
});
