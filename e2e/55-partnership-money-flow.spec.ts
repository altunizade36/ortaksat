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
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
}

/**
 * PARA AKIŞI uçtan uca: ortaklık → referans linki → satış → komisyon → kazanç.
 * Her adım DB'den doğrulanır (arayüz metni yanıltıcı olabiliyor).
 */
test("PARA AKIŞI: ortak ol → satış kaydet → komisyon → kazanç", async ({ page }) => {
  test.setTimeout(600_000);

  const sellerEmail = uniqueEmail("mfseller");
  const partnerEmail = uniqueEmail("mfpartner");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E Satici");
  const partnerId = await createConfirmedUser(partnerEmail, PW, "E2E Ortak");

  // Satıcının ANINDA ORTAK (open) ilanı — %10 komisyon
  const rows = await runSql<Array<{ id: string }>>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'E2E PARA AKISI URUNU',
            'e2e-para-' || substr(md5(random()::text),1,8), 'İstanbul', 'test urun', 'Otomobil',
            100000, 'rate', 10, 'active', 5, false, 'open')
    returning id`);
  const listingId = rows[0].id;
  console.log(`\nilan=${listingId} (open, %10 komisyon, 100.000₺)`);

  // --- 1) ORTAK: ilana ortak ol ---
  await login(page, partnerEmail);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const ortakBtn = page.getByText(/Ortak ol|Ortaklık iste|Hemen ortak ol/i).first();
  console.log(`ortak-ol butonu var mı: ${(await ortakBtn.count()) > 0}`);
  await ortakBtn.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await ortakBtn.tap({ timeout: 8000 }).catch((e) => console.log("  tap hata: " + e.message.slice(0, 50)));
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "e2e-artifacts/mf-1-ortak.png" });

  const p1 = await runSql<Array<Record<string, unknown>>>(
    `select id, status, ref_code, agreed_commission_type, agreed_commission_value, agreed_at
       from partnerships where listing_id='${listingId}' and partner_id='${partnerId}'`
  );
  console.log("DB ORTAKLIK:", JSON.stringify(p1));
  if (!p1.length) { console.log("!! ORTAKLIK OLUŞMADI — akış burada kırılıyor"); return; }
  const partnershipId = p1[0].id as string;
  const refCode = p1[0].ref_code as string;

  // --- 2) Referans linki public olarak çözülüyor mu? ---
  const links = await runSql<Array<Record<string, unknown>>>(
    `select ref_code, slug from referral_public_links where partnership_id='${partnershipId}'`
  );
  console.log(`REFERANS LİNKİ (public): ${links.length ? JSON.stringify(links) : "!! YOK — ortak link paylaşamaz"}`);

  // --- 3) SATICI: bu ortak için satış kaydet ---
  await logout(page);
  await login(page, sellerEmail);
  await page.goto("/seller", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "e2e-artifacts/mf-2-satici.png" });

  // ARTIK GENİŞLETMEDEN görünmeli: aktif ortak varsa bölüm OTOMATİK açılır.
  const satisBtnOnce = page.getByText(/Satış ekle|Satış kaydet|Satışa çevir|Talep \/ randevu kaydet|Randevu kaydet/i).first();
  console.log(`GENİŞLETMEDEN satış butonu görünüyor mu: ${(await satisBtnOnce.count()) > 0 ? "EVET ✓" : "HAYIR ✗"}`);

  const satisBtn = page.getByText(/Satış ekle|Satış kaydet|Satışa çevir|Talep \/ randevu kaydet|Randevu kaydet/i).first();
  console.log(`satış-kaydet butonu var mı: ${(await satisBtn.count()) > 0}`);
  if (await satisBtn.count()) {
    await satisBtn.scrollIntoViewIfNeeded().catch(() => {});
    await satisBtn.tap({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "e2e-artifacts/mf-3-satis-modal.png" });
    // modaldaki tutar alanını doldur + onayla
    for (const inp of await page.locator("input").all()) {
      if (!(await inp.isVisible().catch(() => false))) continue;
      const v = await inp.inputValue().catch(() => "x");
      if (!v) await inp.fill("100000").catch(() => {});
    }
    await page.waitForTimeout(500);
    await page.getByText(/^(Kaydet|Onayla|Satışı Kaydet|Ekle)/).first().tap({ timeout: 6000 }).catch(() => console.log("  kaydet tıklanamadı"));
    await page.waitForTimeout(5000);
    await page.screenshot({ path: "e2e-artifacts/mf-4-satis-sonrasi.png" });
  }

  const comms = await runSql<Array<Record<string, unknown>>>(
    `select id, status, amount, sale_amount, buyer_confirm_token is not null as has_token
       from commissions where partnership_id='${partnershipId}'`
  );
  console.log("DB KOMİSYON:", comms.length ? JSON.stringify(comms) : "!! KOMİSYON OLUŞMADI");

  // --- 4) ORTAK: kazançlar panelinde görünüyor mu? ---
  await logout(page);
  await login(page, partnerEmail);
  await page.goto("/earnings", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "e2e-artifacts/mf-5-kazanc.png" });
  const kazancText = await page.locator("body").innerText();
  console.log(`KAZANÇ PANELİ: ürün görünüyor mu=${/E2E PARA AKISI URUNU/i.test(kazancText)} | ₺10.000 var mı=${/10[.,]000/.test(kazancText)}`);

  await page.goto("/partner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "e2e-artifacts/mf-6-ortak-panel.png" });
  const ortakText = await page.locator("body").innerText();
  console.log(`ORTAK PANELİ: ortaklık görünüyor mu=${/E2E PARA AKISI URUNU/i.test(ortakText)}`);
});
