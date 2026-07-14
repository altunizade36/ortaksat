import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  const eb = page.getByText(/E-posta ile giriş yap/i).first();
  if (await eb.count().then((c) => c > 0).catch(() => false)) await eb.click();
  else await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(5500);
}

const draft = (uid: string, step: number) => JSON.stringify({
  savedAt: Date.now(), step,
  path: [{ key: "genel", label: "Genel Ürün", slug: "genel-urun", formKey: "alisverisGenel" }],
  values: { title: "E2E DOGRULAMA", condition: "İkinci el", price: "50000", description: "yeterince uzun bir açıklama örneği." },
  images: ["https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200"],
  loc: { provinceId: 34, districtId: 34001 }, visibility: "neighborhood", currency: "TRY",
  commissionType: "rate", commissionValue: "15", bonusAmount: "", bonusQuota: "",
  partnershipMode: "approval", partnerNote: "", contactMethod: "message"
});

async function toStep(page: Page, uid: string, step: number) {
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [`ortaksat_listing_draft_v1:${uid}`, draft(uid, step)] as const);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByText(/Devam et/i).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

test("ADIM İYİLEŞTİRMELERİ: yasal kutu açılır, foto metni doğru", async ({ page }) => {
  test.setTimeout(200_000);
  const email = uniqueEmail("stepv");
  const uid = await createConfirmedUser(email, PW, "E2E StepVerify");
  await login(page, email);

  // KONUM adımı: yasal kutu KAPALI (tek satır) → 6 madde görünmemeli
  await toStep(page, uid, 2);
  let body = await page.locator("body").innerText();
  expect(body.includes("Ortaksat aracı platformdur"), "kompakt özet satırı olmalı").toBeTruthy();
  expect(body.includes("cüzdan, bakiye veya güvenli ödeme"), "kapalıyken 6 madde görünmemeli").toBeFalsy();

  // Aç → 6 madde görünmeli (işlev korundu)
  await page.getByText(/Ortaksat aracı platformdur/).first().click();
  await page.waitForTimeout(600);
  body = await page.locator("body").innerText();
  expect(body.includes("cüzdan, bakiye veya güvenli ödeme"), "açınca tüm maddeler görünmeli").toBeTruthy();
  console.log("yasal kutu: kapalı özet + açınca 6 madde ✓");

  // FOTOĞRAFLAR adımı: metin "en fazla 15" olmalı, "en fazla 5" olmamalı
  await toStep(page, uid, 3);
  body = await page.locator("body").innerText();
  expect(body.includes("en fazla 15"), "foto metni 15 olmalı").toBeTruthy();
  expect(body.includes("en fazla 5 görsel"), "eski '5' metni kalmamalı").toBeFalsy();
  console.log("foto metni: 'en fazla 15' ✓");
});
