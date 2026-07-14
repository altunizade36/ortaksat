import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  // Auth ekranının İKİ düzeni var: masaüstü butonu "Giriş Yap", mobil butonu
  // "E-posta ile giriş yap". Bu test masaüstü viewport kullanıyor → ikisini de dene.
  const emailBtn = page.getByText(/E-posta ile giriş yap/i).first();
  if (await emailBtn.count().then((c) => c > 0).catch(() => false)) {
    await emailBtn.click();
  } else {
    await page.getByText("Giriş Yap", { exact: true }).last().click();
  }
  await page.waitForTimeout(5500);
}

const SECRET = "A KULLANICISININ GIZLI YARIM ILANI";

/** Yarım kalan ilan taslağı (uygulamanın yazdığı biçim). */
const draftFor = () => JSON.stringify({
  savedAt: Date.now(),
  step: 1,
  path: [{ key: "elektronik", label: "Elektronik", slug: "elektronik", formKey: "elektronikGenel" }],
  values: { title: SECRET, price: "45000" },
  images: [],
  loc: {},
  visibility: "neighborhood",
  currency: "TRY",
  commissionType: "rate",
  commissionValue: "15",
  bonusAmount: "",
  bonusQuota: "",
  partnershipMode: "approval",
  partnerNote: "",
  contactMethod: "message"
});

/**
 * TASLAK İZOLASYONU. Taslak anahtarı SABİTTİ ("ortaksat_listing_draft_v1") ve çıkışta
 * silinmiyordu → A'nın yarım ilanı (başlık/fiyat/fotoğraf/konum) AYNI CİHAZDA B'ye
 * "Yarım kalan bir ilanın var" diye açılıyordu. Anahtar artık kullanıcıya özel.
 *
 * İki yönlü test: (1) kendi taslağını SAHİBİ görebilmeli, (2) BAŞKASI görmemeli.
 */
test("TASLAK İZOLASYONU: sahibi görür, başkası GÖRMEZ", async ({ page }) => {
  test.setTimeout(600_000);

  const aEmail = uniqueEmail("draftA");
  const bEmail = uniqueEmail("draftB");
  const aId = await createConfirmedUser(aEmail, PW, "E2E TaslakA");
  await createConfirmedUser(bEmail, PW, "E2E TaslakB");

  const aKey = `ortaksat_listing_draft_v1:${aId}`;

  // 1) A giriş yapar, A'nın taslağı cihazda → A BUNU GÖRMELİ (mekanizma çalışıyor mu)
  await login(page, aEmail);
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [aKey, draftFor()] as const);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await expect(
    page.getByText(/Yarım kalan bir ilanın var/i).first(),
    "sahibi kendi taslağını görebilmeli (yoksa taslak özelliği tamamen ölmüş olur)"
  ).toBeVisible();
  console.log("1/2 A kendi taslagini gordu ✓");

  // 2) B giriş yapar; A'nın taslağı hâlâ cihazda → B GÖRMEMELİ
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ } });
  await login(page, bEmail);
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [aKey, draftFor()] as const);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  await expect(
    page.getByText(/Yarım kalan bir ilanın var/i),
    "B kullanıcısına A'nın taslağı açılıyor — SIZINTI"
  ).toHaveCount(0);
  await expect(
    page.getByText(SECRET),
    "A'nın ilan başlığı B'nin ekranında görünüyor — SIZINTI"
  ).toHaveCount(0);

  console.log("2/2 B, A'nin taslagini GORMEDI ✓  (izolasyon calisiyor)");
});
