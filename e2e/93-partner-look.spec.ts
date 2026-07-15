import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/partner-look";
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

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

async function seed() {
  const sellerId = await createConfirmedUser(uniqueEmail("prtseller"), PW, "Satıcı Firma");
  const partnerEmail = uniqueEmail("prtpartner");
  const partnerId = await createConfirmedUser(partnerEmail, PW, "Ortak Kişi");
  // Satıcının bir ilanı (herkese açık ortaklık fırsatı)
  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'Bluetooth Kulaklık Pro',
            'e2e-prt-' || substr(md5(random()::text),1,8), 'İstanbul', 'temiz', 'Kulaklık',
            3500, 'rate', 20, 'active', 10, false, 'open') returning id`);
  const listingId = l!.id;
  // Aktif bir ortaklık (partner bu ilanın ortağı). partnerships: ref_code ZORUNLU,
  // seller listing.owner_id'den türer (seller_id kolonu YOK). status='active'.
  await runSql(`insert into partnerships (id, listing_id, partner_id, ref_code, status, created_at)
    values (gen_random_uuid(), '${listingId}', '${partnerId}', 'e2eprt' || substr(md5(random()::text),1,6), 'active', now())`);
  return { partnerEmail, listingId, partnerId };
}

test("ORTAK görünüm (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const { partnerEmail } = await seed();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1500 } });
  const page = await ctx.newPage();
  await login(page, partnerEmail);
  await page.goto("/partner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}/d-partner.png`, fullPage: true }).catch(() => {});

  // AKTİF ORTAKLIK doğru yansımalı: sayaç + sekme + GERÇEK referans linki (/i/<refCode>).
  const body = await page.locator("body").innerText();
  expect(body.includes("Aktif ortaklıklar"), "Aktif ortaklıklar sekmesi olmalı").toBeTruthy();
  // shareUrl formatı: /i/<slug>?ref=<refCode> — ekranda slug (e2e-prt-…) görünür, ref query kırpılır.
  const hasRefLink = /ortaksat\.com\/i\/e2e-prt/.test(body);
  console.log(`ortak referans (paylaşım) linki görünür mü: ${hasRefLink}`);
  expect(hasRefLink, "aktif ortaklıkta paylaşım referans linki görünmeli").toBeTruthy();
  console.log("ORTAK AKISI OK: aktif ortaklık + referans linki");

  await ctx.close();
});

test("ORTAK görünüm (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const { partnerEmail } = await seed();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await login(page, partnerEmail);
  await page.goto("/partner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}/m-partner.png`, fullPage: true }).catch(() => {});
  await ctx.close();
});
