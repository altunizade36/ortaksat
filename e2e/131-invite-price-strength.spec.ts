import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

/**
 * ORTAKLIK DAVETİ + FİYAT GEÇMİŞİ + İLAN GÜCÜ (2026-11-15).
 * - Satıcı, ortağın vitrininden onu ilanına davet eder → davet kaydı + ortağa bildirim; ikinci davet tekrarlanmaz.
 * - İlan fiyatı değişince ilan sayfasında fiyat geçmişi satırı görünür.
 * - Satıcı panelinde ilan gücü kartı ve önerileri görünür.
 */
const PW = "GucluSifre123!";
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByRole("button", { name: "E-posta ile giriş yap" }).last().click();
  await page.waitForTimeout(5500);
}

test("satıcı ortağı ilanına davet eder; fiyat geçmişi ve ilan gücü görünür", async ({ browser }) => {
  test.setTimeout(400_000);
  const sellerEmail = uniqueEmail("invseller");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E Davet Satici");
  const partnerId = await createConfirmedUser(uniqueEmail("invpartner"), PW, "E2E Davet Ortak");
  const listing = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'E2E DAVET URUNU', 'e2e-inv-' || substr(md5(random()::text),1,8), 'İstanbul',
            'Davet testi için yeterince uzun bir ürün açıklaması.', 'Cep Telefonu', 30000, 'rate', 10, 'active', 5, false, 'open')
    returning id`);
  const listingId = listing!.id;

  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  await ctx.addInitScript(() => { try { localStorage.setItem("ortaksat.cookieConsent.v1", JSON.stringify({ v: 1, analytics: false, marketing: false, at: "t" })); } catch {} });
  const page = await ctx.newPage();
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  await login(page, sellerEmail);

  // ---- 1) Davet
  await page.goto(`/ortak/${partnerId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.getByTestId("partner-invite-open").click();
  await expect(page.getByText("Hangi ilanına davet edeceksin?")).toBeVisible();
  await page.getByTestId("partner-invite-listing").first().click();
  await expect(page.getByText(/Davet gönderildi\. Ortak bildirimi görünce/)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "e2e-artifacts/invite/1-davet.png" });
  const invite = await one<{ n: number }>(`select count(*)::int as n from partnership_invites where listing_id='${listingId}' and partner_id='${partnerId}' and seller_id='${sellerId}'`);
  expect(invite?.n, "davet kaydı oluşmalı").toBe(1);
  const notif = await one<{ title: string; listing: string; actor: string }>(`select title, metadata->>'listingId' as listing, actor_id::text as actor from notifications where user_id='${partnerId}' order by created_at desc limit 1`);
  expect(notif?.title).toBe("Ortaklık daveti");
  expect(notif?.listing, "bildirim ilana götürmeli").toBe(listingId);
  expect(notif?.actor).toBe(sellerId);

  // Aynı davet ikinci kez gönderilmez (pencere yeniden açılır → sunucu "already" der, yeni bildirim oluşmaz).
  await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(5000);
  await page.getByTestId("partner-invite-open").click();
  await page.getByTestId("partner-invite-listing").first().click();
  await expect(page.getByText("Bu ortağı bu ilana daha önce davet etmiştin.")).toBeVisible({ timeout: 15_000 });
  const notifCount = await one<{ n: number }>(`select count(*)::int as n from notifications where user_id='${partnerId}' and title='Ortaklık daveti'`);
  expect(notifCount?.n, "tekrar davet yeni bildirim üretmemeli").toBe(1);

  // ---- 2) Fiyat geçmişi
  await runSql(`update listings set price = 27000 where id='${listingId}'`);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("price-history").first()).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId("price-history").first()).toContainText("%10 indi");
  await page.screenshot({ path: "e2e-artifacts/invite/2-fiyat.png" });

  // ---- 3) İlan gücü (satıcı paneli)
  await page.goto("/seller", { waitUntil: "domcontentloaded" });
  // Panel "Özet" sekmesinde açılır; ilan satırları "İlanlarım" sekmesindedir.
  await page.getByText("İlanlarım", { exact: true }).first().click({ timeout: 25_000 });
  await expect(page.getByTestId("listing-strength").first()).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId("listing-strength").first()).toContainText("İlan gücü");
  await expect(page.getByTestId("listing-strength").first()).toContainText(/Fotoğraf ekle|fotoğraf daha ekle/);
  await page.getByTestId("listing-strength").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "e2e-artifacts/invite/3-guc.png" });
  expect(errors, "sayfa hatası olmamalı").toEqual([]);
  await ctx.close();
});
