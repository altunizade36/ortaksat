import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  const emailBtn = page.getByText(/E-posta ile giriş yap/i).first();
  if (await emailBtn.count().then((c) => c > 0).catch(() => false)) await emailBtn.click();
  else await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(5500);
}

/**
 * YAYIN SONRASI BAŞARI EKRANI. Eskiden kullanıcı yayından sonra doğrudan panele atılıyordu;
 * elinde ne gerçek ilan linki ne de paylaş/ortak-davet vardı (paylaşım metinleri yayından
 * ÖNCE gösterildiği için gerçek linki içeremiyordu). Artık: gerçek link + Paylaş + Ortak
 * davet + İlanı gör.
 *
 * 6 adımlık formu tek tek gezmek yerine, uygulamanın kendi TASLAK-GERİ-YÜKLEME yolunu
 * kullanıp (tam dolu taslak → "Devam et") doğrudan önizleme adımına atlıyoruz. Böylece
 * test hem hızlı hem sağlam; sonra gerçekten yayınlayıp başarı ekranını doğruluyoruz.
 */
test("YAYIN SONRASI: başarı ekranı gerçek link ile gelir", async ({ page }) => {
  test.setTimeout(300_000);

  const email = uniqueEmail("pubok");
  const uid = await createConfirmedUser(email, PW, "E2E YayinBasari");
  await login(page, email);

  const draft = {
    savedAt: Date.now(),
    step: 5, // doğrudan Önizleme & Yayınla adımı
    path: [{ key: "genel", label: "Genel Ürün", slug: "genel-urun", formKey: "alisverisGenel" }],
    values: {
      title: "E2E BASARI EKRANI URUNU",
      condition: "İkinci el",
      price: "50000",
      description: "E2E test ilanı açıklaması — ürün temiz ve bakımlı, detaylar için mesaj atın."
    },
    images: ["https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200"],
    loc: { provinceId: 34, districtId: 34001 },
    visibility: "neighborhood",
    currency: "TRY",
    commissionType: "rate",
    commissionValue: "15",
    bonusAmount: "",
    bonusQuota: "",
    partnershipMode: "approval",
    partnerNote: "",
    contactMethod: "message"
  };
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [`ortaksat_listing_draft_v1:${uid}`, JSON.stringify(draft)] as const);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Taslağı geri yükle → tüm form state dolar, önizleme adımına gelir
  await page.getByText(/Devam et/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const yayinla = page.getByText("İlanı Yayınla", { exact: true }).first();
  await expect(yayinla, "önizleme adımında Yayınla butonu olmalı").toBeVisible({ timeout: 10000 });
  await yayinla.click();
  await page.waitForTimeout(6000);

  const body = await page.locator("body").innerText();

  // 1) Başarı ekranı
  expect(/İlanın yayında|incelemeye alındı/.test(body), "yayından sonra başarı ekranı görünmeli").toBeTruthy();
  // 2) GERÇEK ilan linki (/listing/<uuid>)
  expect(/ortaksat\.com\/listing\//.test(body), "başarı ekranında gerçek ilan linki olmalı").toBeTruthy();
  // 3) Paylaş + Ortak davet linki
  expect(body.includes("Paylaş"), "Paylaş butonu olmalı").toBeTruthy();
  expect(body.includes("Ortak davet linki"), "Ortak davet linki butonu olmalı").toBeTruthy();

  // 4) DB'de gerçekten oluştu
  const rows = await runSql<Array<{ id: string; status: string; price: string }>>(
    `select id, status::text, price::text from listings where owner_id='${uid}' order by created_at desc limit 1`
  );
  expect(rows.length, "ilan DB'de olmalı").toBeGreaterThan(0);
  expect(Number(rows[0].price), "fiyat 50000 kaydedilmeli").toBe(50000);

  console.log(`YAYIN BASARI OK: ilan=${rows[0].id.slice(0, 8)} status=${rows[0].status} fiyat=${rows[0].price}`);

  await runSql(`delete from listings where owner_id='${uid}'`);
});
