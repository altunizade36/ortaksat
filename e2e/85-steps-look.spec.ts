import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/steps-look";

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
  values: { title: "E2E ADIM GORUNUM URUNU", condition: "İkinci el", price: "50000", description: "E2E açıklama metni yeterince uzun bir örnek." },
  images: ["https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200"],
  loc: { provinceId: 34, districtId: 34001 }, visibility: "neighborhood", currency: "TRY",
  commissionType: "rate", commissionValue: "15", bonusAmount: "", bonusQuota: "",
  partnershipMode: "approval", partnerNote: "", contactMethod: "message"
});

async function capture(page: Page, uid: string, tag: string, steps: Array<[number, string]>) {
  for (const [step, name] of steps) {
    await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [`ortaksat_listing_draft_v1:${uid}`, draft(uid, step)] as const);
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    await page.getByText(/Devam et/i).first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: true }).catch(() => {});
  }
}

const STEPS: Array<[number, string]> = [[2, "konum"], [3, "foto"], [4, "komisyon"], [5, "onizleme"]];

test("ADIMLAR görünüm (masaüstü)", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  const page = await ctx.newPage();
  const email = uniqueEmail("stpd");
  const uid = await createConfirmedUser(email, PW, "E2E StepsD");
  await login(page, email);
  await capture(page, uid, "d", STEPS);
  await ctx.close();
});

test("ADIMLAR görünüm (mobil)", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const email = uniqueEmail("stpm");
  const uid = await createConfirmedUser(email, PW, "E2E StepsM");
  await login(page, email);
  await capture(page, uid, "m", STEPS);
  await ctx.close();
});
