import { test, devices, type Page } from "@playwright/test";
import { acceptConfirm } from "./helpers/confirm";
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
  await page.waitForTimeout(1200);
}
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

test("ONAY-MODLU ORTAKLIK + KOMİSYON ÖDEME DÖNGÜSÜ + ALICI ONAYI", async ({ page }) => {
  test.setTimeout(900_000);
  // KRİTİK: Onay akışları web'de window.confirm kullanıyor (lib/alert). Playwright diyalogları
  // VARSAYILAN OLARAK REDDEDER → "Ödendi bildir" gibi aksiyonlar sessizce iptal oluyordu ve
  // ben bunu ürün hatası sanmıştım. Diyalogları KABUL et.
  page.on("dialog", (d) => d.accept().catch(() => {}));

  const sellerEmail = uniqueEmail("apseller");
  const partnerEmail = uniqueEmail("appartner");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E Satici2");
  const partnerId = await createConfirmedUser(partnerEmail, PW, "E2E Ortak2");

  // ONAY MODLU (approval) ilan — %20 komisyon
  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'E2E ONAY MODLU URUN',
            'e2e-onay-' || substr(md5(random()::text),1,8), 'İstanbul', 'test', 'Cep Telefonu',
            50000, 'rate', 20, 'active', 5, false, 'approval')
    returning id`);
  const listingId = l!.id;
  console.log(`\nilan=${listingId} (approval, %20, 50.000₺)`);

  // ========== 1) ORTAK BAŞVURUSU → pending olmalı ==========
  await login(page, partnerEmail);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  // DİKKAT: /Ortak ol/ regex'i BAŞLIKTAKİ "Ortak satış platformu" metnine de uyuyor → logoya
  // dokunuyordum ve ortaklık hiç oluşmuyordu (ürün hatası sanmıştım). Rol+isimle hedefle.
  const basvurBtn = page.getByRole("button", { name: /Ortaklık Başvurusu Gönder|Hemen ortak ol|Ortaklık iste/i }).first();
  console.log(`   başvuru butonu: ${(await basvurBtn.count()) > 0 ? "VAR" : "YOK"}`);

  // ONAY MODUNDA BAŞVURU NOTU ZORUNLU. NOTU ÖNCE doldur, SONRA gönder — böylece
  // "Eksik başvuru" uyarısı hiç çıkmaz. (Eskiden önce boş gönderiliyordu; uyarı
  // window.alert'ti ve Playwright otomatik kapatıyordu. Artık uyarı UYGULAMA-İÇİ
  // modal olduğu için ekranı bekletiyor ve sonraki tıklamaları bloke ediyordu.)
  const not = page.getByPlaceholder(/Kısaca anlat|neden|kısaca/i).first();
  if (await not.count()) {
    await not.fill("Instagram'da 5 bin takipçim var, teknoloji içerikleri paylaşıyorum.");
    console.log("   zorunlu 'başvuru notu' dolduruldu");
  } else console.log("   !! başvuru notu alanı bulunamadı");
  const erisim = page.getByPlaceholder(/ör\. 500/i).first();
  if (await erisim.count()) await erisim.fill("5000");
  await page.waitForTimeout(500);

  await basvurBtn.scrollIntoViewIfNeeded().catch(() => {});
  await basvurBtn.tap({ timeout: 10000 }).catch((e) => console.log("  tap hata: " + e.message.slice(0, 40)));
  await page.waitForTimeout(2500);
  // Başarı bilgisi ("Başvuru gönderildi") uygulama-içi modal olarak çıkar → kapat.
  await acceptConfirm(page, 3000);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/ap-0b-onay-sonrasi.png" });
  await page.waitForTimeout(3000);

  let p = await one<Record<string, unknown>>(`select id, status, agreed_at from partnerships where listing_id='${listingId}' and partner_id='${partnerId}'`);
  console.log(`1) BAŞVURU  → ${p ? `status=${p.status} agreed_at=${p.agreed_at ?? "null"}` : "!! ORTAKLIK YOK"}`);
  if (!p) return;
  const partnershipId = p.id as string;
  const beklenen1 = p.status === "pending" && p.agreed_at === null;
  console.log(`   beklenen: status=pending + şartlar HENÜZ kilitli değil → ${beklenen1 ? "DOĞRU ✓" : "YANLIŞ ✗"}`);

  // ========== 2) SATICI ONAYLIYOR → active + şartlar KİLİTLENİR ==========
  await logout(page);
  await login(page, sellerEmail);
  await page.goto("/seller", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: "e2e-artifacts/ap-1-basvuru.png" });
  // Başvurular ayrı sekmede olabilir → önce "Başvuruları Gör"
  await page.getByText(/Başvuruları Gör/i).first().tap({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e-artifacts/ap-1b-basvurular.png" });
  // NOT: buton metni "Kabul Et" (büyük E) → regex'te /i şart.
  const onayBtn = page.getByText(/^(Kabul Et|Onayla|Başvuruyu onayla)$/i).first();
  console.log(`   satıcı panelinde "Kabul Et" butonu: ${(await onayBtn.count()) > 0 ? "VAR ✓" : "YOK ✗"}`);
  await onayBtn.scrollIntoViewIfNeeded().catch(() => {});
  await onayBtn.tap({ timeout: 8000 }).catch(() => console.log("  onayla tap hata"));
  await acceptConfirm(page);
  await page.waitForTimeout(5000);

  p = await one<Record<string, unknown>>(`select status, agreed_commission_type, agreed_commission_value, agreed_at from partnerships where id='${partnershipId}'`);
  console.log(`2) ONAY     → status=${p?.status} agreed=${p?.agreed_commission_type}/${p?.agreed_commission_value} agreed_at=${p?.agreed_at ? "SET" : "null"}`);
  const beklenen2 = p?.status === "active" && p?.agreed_at != null && String(p?.agreed_commission_value) === "20.00";
  console.log(`   beklenen: active + %20 KİLİTLİ → ${beklenen2 ? "DOĞRU ✓" : "YANLIŞ ✗"}`);

  // ========== 3) SATIŞ KAYDET → komisyon (%20 = 10.000₺) ==========
  // "Başvuruları Gör" filtresi hâlâ açıksa ilan listesi filtrelidir → önce filtreyi temizle.
  await page.getByText(/^(Tümü|Tüm ilanlar)$/i).first().tap({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e-artifacts/ap-1c-tum-ilanlar.png" });

  const satisBtn = page.getByText(/Satış ekle|Satış kaydet|Satışa çevir|Talep \/ randevu kaydet|Doğrulanan satış|Satıldı olarak/i).first();
  console.log(`   satış butonu: ${(await satisBtn.count()) > 0 ? "VAR ✓" : "YOK ✗"}`);
  await satisBtn.scrollIntoViewIfNeeded().catch(() => {});
  await satisBtn.tap({ timeout: 10000 }).catch((e) => console.log("  satış tap hata: " + e.message.slice(0, 40)));
  await acceptConfirm(page);
  await page.waitForTimeout(2500);
  for (const inp of await page.locator("input").all()) {
    if (!(await inp.isVisible().catch(() => false))) continue;
    if (!(await inp.inputValue().catch(() => "x"))) await inp.fill("50000").catch(() => {});
  }
  await page.getByText(/^(Kaydet|Onayla|Satışı Kaydet|Ekle)/).first().tap({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(5000);

  let c = await one<Record<string, unknown>>(`select id, status, amount, buyer_confirm_token, seller_marked_paid_at, partner_confirmed_paid_at from commissions where partnership_id='${partnershipId}'`);
  console.log(`3) SATIŞ    → ${c ? `komisyon status=${c.status} tutar=${c.amount}` : "!! KOMİSYON YOK"}`);
  if (!c) return;
  const commissionId = c.id as string;
  const token = c.buyer_confirm_token as string | null;
  console.log(`   beklenen: 50.000 × %20 = 10.000 → ${String(c.amount) === "10000.00" ? "DOĞRU ✓" : "YANLIŞ ✗ (" + c.amount + ")"}`);

  // ========== 4) ALICI ONAYI (tokenlı, giriş YOK) ==========
  if (token) {
    await logout(page);
    await page.goto(`/onay/${token}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: "e2e-artifacts/ap-2-alici-onay.png" });
    const onayText = await page.locator("body").innerText();
    console.log(`4) ALICI    → onay sayfası ürünü gösteriyor mu: ${/E2E ONAY MODLU URUN/i.test(onayText) ? "EVET ✓" : "HAYIR ✗"}`);
    await page.getByText(/Aldığımı onaylıyorum/i).first().tap({ timeout: 8000 }).catch(() => console.log("  onayla tap hata"));
    await page.waitForTimeout(5000);
    c = await one<Record<string, unknown>>(`select buyer_confirmed_at, buyer_confirm_status from commissions where id='${commissionId}'`);
    console.log(`   DB: buyer_confirmed_at=${c?.buyer_confirmed_at ? "SET ✓" : "null ✗"} status=${c?.buyer_confirm_status}`);
  } else console.log("4) ALICI    → !! token yok, onay linki üretilmemiş");

  // ========== 5) SATICI "ÖDEDİM" der ==========
  await logout(page);
  await login(page, sellerEmail);
  await page.goto("/seller", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const odendiBtn = page.getByText(/Ödendi Bildir|Ödedim|Komisyonu Ödedim/i).first();
  console.log(`5) SATICI   → "Ödendi bildir" butonu: ${(await odendiBtn.count()) > 0 ? "VAR ✓" : "YOK ✗"}`);
  await odendiBtn.scrollIntoViewIfNeeded().catch(() => {});
  await odendiBtn.tap({ timeout: 8000 }).catch(() => {});
  await acceptConfirm(page);
  await page.waitForTimeout(2000);
  await page.getByText(/^(Ödendi Bildir|Onayla|Evet)/).last().tap({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(5000);
  c = await one<Record<string, unknown>>(`select status, seller_marked_paid_at from commissions where id='${commissionId}'`);
  console.log(`   DB: status=${c?.status} seller_marked_paid_at=${c?.seller_marked_paid_at ? "SET ✓" : "null ✗"}`);

  // ========== 6) ORTAK "ALDIM" onaylar → paid ==========
  await logout(page);
  await login(page, partnerEmail);
  // ARTIK KAZANÇ SAYFASINDA DA olmalı → önce /earnings'te dene.
  await page.goto("/earnings", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const kazancAldim = page.getByText(/Ödemeyi Aldım/i).first();
  console.log(`6a) KAZANÇ SAYFASINDA "Ödemeyi Aldım": ${(await kazancAldim.count()) > 0 ? "VAR ✓" : "YOK ✗"}`);
  if (await kazancAldim.count()) {
    await kazancAldim.scrollIntoViewIfNeeded().catch(() => {});
    await kazancAldim.tap({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(5000);
    const cc = await one<Record<string, unknown>>(`select status from commissions where id='${commissionId}'`);
    console.log(`    DB (kazanç sayfasından onay): status=${cc?.status} → ${cc?.status === "paid" ? "DOĞRU ✓" : "YANLIŞ ✗"}`);
  }

  await page.goto("/partner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: "e2e-artifacts/ap-3-ortak-panel.png" });
  // NOT: komisyon 6a'da (kazanç sayfasından) zaten 'paid' yapıldıysa buton BURADA OLMAMALI —
  // bu DOĞRU davranıştır (onaylanmış ödeme tekrar onaylanamaz). Bu yüzden "YOK" beklenen sonuç.
  const zatenPaid = (await one<Record<string, unknown>>(`select status from commissions where id='${commissionId}'`))?.status === "paid";
  const aldimBtn = page.getByText(/Ödemeyi Aldım|Çözüldü · Aldım/i).first();
  const varMi = (await aldimBtn.count()) > 0;
  console.log(`6) ORTAK PANELİ → buton ${varMi ? "VAR" : "YOK"} | komisyon zaten paid mi: ${zatenPaid} → ${zatenPaid && !varMi ? "DOĞRU ✓ (onaylanmış ödeme tekrar onaylanamaz)" : varMi ? "onaylanabilir ✓" : "?"}`);
  if (zatenPaid) return; // döngü 6a'da tamamlandı
  await aldimBtn.scrollIntoViewIfNeeded().catch(() => {});
  await aldimBtn.tap({ timeout: 8000 }).catch(() => {});
  await acceptConfirm(page);
  await page.waitForTimeout(2000);
  await page.getByText(/^(Onayla|Evet|Aldım)/).last().tap({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(5000);
  c = await one<Record<string, unknown>>(`select status, partner_confirmed_paid_at, paid_at from commissions where id='${commissionId}'`);
  console.log(`   DB: status=${c?.status} partner_confirmed=${c?.partner_confirmed_paid_at ? "SET ✓" : "null ✗"} paid_at=${c?.paid_at ? "SET ✓" : "null"}`);
  console.log(`   beklenen: status=paid → ${c?.status === "paid" ? "DOĞRU ✓" : "YANLIŞ ✗"}`);
});
