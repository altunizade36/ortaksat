import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/info-look";

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

async function toInfo(page: Page, query: string, pick: RegExp) {
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByText(/^Yeni başla/).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill(query);
  await page.waitForTimeout(1600);
  await page.getByText(pick).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

test("İLAN BİLGİLERİ görünüm (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  const email = uniqueEmail("infod");
  await createConfirmedUser(email, PW, "E2E InfoD");
  await login(page, email);

  await toInfo(page, "otomobil", /Otomobil/i);
  await page.screenshot({ path: `${OUT}/d-otomobil.png`, fullPage: true }).catch(() => {});

  // GAP DÜZELTMESİ: başlık artık kategori artefaktıyla ("Markaya Göre") dolu GELMEMELİ,
  // ve kategoriye özel örnek placeholder göstermeli.
  const titleField = page.getByTestId("field-title").first();
  const titleVal = await titleField.inputValue().catch(() => "?");
  const titlePh = await titleField.getAttribute("placeholder").catch(() => "");
  console.log(`başlık değeri: "${titleVal}" | placeholder: "${titlePh}"`);
  expect(titleVal.includes("Markaya Göre"), "başlık artefaktı sızmamalı").toBeFalsy();
  expect((titlePh ?? "").includes("Örn."), "başlık örnek placeholder göstermeli").toBeTruthy();

  // ŞABLON: boş açıklamaya tek-dokunuş şablon dolmalı
  const tmpl = page.getByTestId("desc-template").first();
  if (await tmpl.count()) {
    await tmpl.click();
    await page.waitForTimeout(800);
    const body = (await page.locator("body").innerText());
    console.log(`şablon eklendi mi (Tramer): ${body.includes("Tramer")}`);
    expect(body.includes("Tramer") || body.includes("km"), "açıklama şablonu dolmalı").toBeTruthy();
  }
  await ctx.close();
});

test("İLAN BİLGİLERİ görünüm (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const email = uniqueEmail("infom");
  await createConfirmedUser(email, PW, "E2E InfoM");
  await login(page, email);

  await toInfo(page, "otomobil", /Otomobil/i);
  await page.screenshot({ path: `${OUT}/m-otomobil.png`, fullPage: true }).catch(() => {});
  await ctx.close();
});
