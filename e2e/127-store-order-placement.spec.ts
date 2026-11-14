import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  // DÜĞME, başlık değil: sayfa başlığı da "E-posta ile giriş yap" olduğundan metne göre ilk eşleşme başlığa tıklıyordu.
  await page.getByRole("button", { name: "E-posta ile giriş yap" }).last().click();
  await page.waitForTimeout(5500);
}

/**
 * (1) YAYIN SONRASI "NEREDE GÖRÜNÜYOR" KARTI: ilan yayınlanınca kategori yolu, Keşfet ve mağaza gösterilir.
 * (2) MAĞAZA SIRASI: satıcı /magaza-sirasi'nda iki ilanın yerini değiştirir, kaydeder; sıra sunucuya yazılır ve
 *     herkese açık mağaza sayfası ilanları o sırayla listeler.
 * İlan, 82-publish-success ile aynı yoldan (dolu taslak → önizleme → yayınla) oluşturulur.
 */
test("Yayın yeri kartı + mağaza sırası uçtan uca", async ({ page }) => {
  test.setTimeout(300_000);
  const email = uniqueEmail("sira");
  const uid = await createConfirmedUser(email, PW, "E2E Sira Magaza");
  // Çerez bandı düğmelerin üstüne binmesin: seçim önceden "reddet" olarak kaydedilir (analitik yüklenmez).
  await page.addInitScript(() => { try { window.localStorage.setItem("ortaksat.cookieConsent.v1", JSON.stringify({ v: 1, analytics: false, marketing: false, at: new Date().toISOString() })); } catch { /* yok say */ } });
  await login(page, email);
  const loggedIn = await page.evaluate(() => Object.keys(window.localStorage).some((k) => /^sb-.*-auth-token$/.test(k)));
  if (!loggedIn) console.log("GİRİŞ OLMADI:", page.url(), (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400));
  expect(loggedIn, "deneme hesabıyla giriş yapılmış olmalı").toBeTruthy();

  const draft = {
    savedAt: Date.now(),
    step: 5,
    // Güncel kategori ağacından GERÇEK bir yaprak yol (eski "Genel Ürün" kökü 16→11 birleştirmesinde kalktı).
    path: [
      { key: "ikinci-el-ve-sifir-alisveris", label: "İkinci El & Sıfır Alışveriş", slug: "ikinci-el-ve-sifir-alisveris" },
      { key: "elektronik", label: "Elektronik", slug: "elektronik" },
      { key: "yazici-ve-tarayici", label: "Yazıcı & Tarayıcı", slug: "yazici-ve-tarayici" }
    ],
    values: { title: "E2E SIRA BIRINCI URUN", brand: "Canon", model: "Deneme Modeli", condition: "İkinci El", shipping: "Kargo var", warranty: "Garantisiz", stock: "1", price: "41000", description: "E2E test ilanı açıklaması — mağaza sırası ve yayın yeri kartı denemesi için oluşturuldu." },
    images: ["https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200"],
    loc: { provinceId: 34, districtId: 34001 },
    visibility: "neighborhood",
    currency: "TRY",
    commissionType: "rate",
    commissionValue: "10",
    bonusAmount: "",
    bonusQuota: "",
    partnershipMode: "open",
    partnerNote: "",
    contactMethod: "message"
  };
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [`ortaksat_listing_draft_v1:${uid}`, JSON.stringify(draft)] as const);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.getByText("Devam et", { exact: true }).first().click({ timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const yayinla = page.getByText("İlanı Yayınla", { exact: true }).first();
  await expect(yayinla, "önizleme adımında Yayınla butonu olmalı").toBeVisible({ timeout: 10000 });
  await page.getByText(/Okudum, kabul ediyorum/i).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(500);
  await yayinla.click();
  await page.waitForTimeout(6000);
  if (!(await page.getByTestId("publish-placement").count())) {
    const alerts = await page.getByRole("alert").allInnerTexts().catch(() => []);
    console.log("YAYINLANMADI — uyarılar:", alerts.join(" || ").replace(/\s+/g, " ").slice(0, 600));
  }

  // (1) Yayın yeri kartı
  const placement = page.getByTestId("publish-placement");
  await expect(placement, "başarı ekranında 'nerede görünüyor' kartı olmalı").toBeVisible({ timeout: 10000 });
  const placementText = await placement.innerText();
  expect(/İlanın nerede görünüyor|Onaylanınca nerede yayınlanacak/.test(placementText), "kart başlığı").toBeTruthy();
  expect(placementText.includes("Yazıcı & Tarayıcı") && placementText.includes("Elektronik"), "tam kategori yolu kartta yazmalı").toBeTruthy();
  expect(placementText.includes("Ana sayfa ve Keşfet") && placementText.includes("Mağazan"), "Keşfet ve mağaza satırları").toBeTruthy();
  await page.screenshot({ path: "e2e-artifacts/sira-1-yayin-yeri.png", fullPage: true });

  const first = await runSql<Array<{ id: string; status: string }>>(`select id, status::text from listings where owner_id='${uid}' order by created_at desc limit 1`);
  expect(first.length, "yayınlanan ilan DB'de olmalı").toBe(1);
  // Otomatik tarama incelemeye aldıysa sıra testi için etkinleştir (test verisi; gerçek ilan değil).
  if (first[0].status !== "active") await runSql(`update listings set status='active' where id='${first[0].id}'`);
  // İkinci ilan doğrudan eklenir (başlık kuralı köşeli parantezi reddettiği için seedListing kullanılmıyor;
  // temizlik deneme hesabının sahipliğinden yapılır).
  const seeded = await runSql<Array<{ id: string }>>(`
    insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency)
    values ('${uid}', 'E2E Sira Ikinci Urun', 'e2e-sira-${Date.now()}', 'E2E mağaza sırası denemesi için ikinci ürün açıklaması yeterince uzun.', 3200, 'rate', 12, 'Elektronik', 'İstanbul', 'active', 'open', 'TRY')
    returning id;`);
  const secondId = seeded[0].id;

  // (2) Mağaza sırası: yeni eklenen (ikinci) en başta gelir; onu aşağı taşı → birinci başa geçer.
  await page.goto("/magaza-sirasi", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "e2e-artifacts/sira-2-once.png", fullPage: true });
  // Ekrandaki İLK satırı aşağı taşı → iki ilanın yeri değişir. (Aynı gün eklenen sırasız ilanlarda ilk satırın
  // hangisi olacağı önceden bilinmez; beklenen sıra ekrandan okunur.)
  const downButtons = page.getByRole("button", { name: /: aşağı taşı$/ });
  await expect(downButtons.first(), "sıralama ekranında 'aşağı taşı' düğmeleri olmalı").toBeVisible({ timeout: 15000 });
  const before = (await downButtons.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") || ""))).map((label) => (/BIRINCI/i.test(label) ? "first" : "second"));
  expect(before.length, "iki ilan listelenmeli").toBe(2);
  await expect(page.getByRole("button", { name: "Sırayı Kaydet" }).first(), "değişiklik yokken kaydet pasif olmalı").toBeDisabled();
  await downButtons.first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Sırayı Kaydet" }).first().click();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: "e2e-artifacts/sira-3-sonra.png", fullPage: true });

  const expected = [before[1], before[0]]; // yer değişti
  const idOf = (which: string) => (which === "first" ? first[0].id : secondId);
  const ranks = await runSql<Array<{ id: string; rank: string | null }>>(`select id, (attributes->>'_storeRank') as rank from listings where owner_id='${uid}'`);
  const rankOf = (id: string) => Number(ranks.find((r) => r.id === id)?.rank);
  expect(rankOf(idOf(expected[0])), "başa alınan ilan 1. sıraya yazılmalı").toBe(1);
  expect(rankOf(idOf(expected[1])), "aşağı taşınan ilan 2. sıraya yazılmalı").toBe(2);
  const untouched = await runSql<Array<{ status: string }>>(`select status::text from listings where owner_id='${uid}'`);
  expect(untouched.every((r) => r.status === "active"), "sıralama ilan durumunu değiştirmemeli").toBeTruthy();

  // Herkese açık mağaza sayfası bu sırayla listeler (oturumsuz ziyaretçi gözüyle).
  const guest = await page.context().browser()!.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  const visitor = await guest.newPage();
  await visitor.goto(`/store/${uid}`, { waitUntil: "domcontentloaded" });
  await visitor.waitForTimeout(6000);
  const cards = visitor.locator('[data-card="listing"]');
  await expect(cards.first(), "mağazada ilan kartları görünmeli").toBeVisible({ timeout: 15000 });
  const titles = await cards.allInnerTexts();
  await visitor.screenshot({ path: "e2e-artifacts/sira-4-magaza.png", fullPage: true });
  const cardKind = (text: string) => (/BIRINCI/i.test(text) ? "first" : /Ikinci/i.test(text) ? "second" : "?");
  expect([cardKind(titles[0] || ""), cardKind(titles[1] || "")], "mağaza kartları kaydedilen sırada olmalı").toEqual(expected);
  await guest.close();

  console.log(`SIRA OK: ekranda ${before.join(" → ")} idi, ${expected.join(" → ")} olarak kaydedildi; mağaza aynı sırada`);
  await runSql(`delete from listings where owner_id='${uid}'`);
});
