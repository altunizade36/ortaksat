import { expect, test } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql, E2E_LISTING_TAG } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

// format.ts listingInviteCode ile bire bir aynı (FNV-1a → base36).
function inviteCode(listingId: string, ownerId: string): string {
  const s = `ortak-davet:${listingId}:${ownerId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(4000);
}

test("davetle-ortaklık: geçerli link anında ortak yapar, kodsuz erişim kapıda durur", async ({ page }) => {
  const sellerEmail = uniqueEmail("inv-seller");
  const partnerEmail = uniqueEmail("inv-partner");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "Davet Satici");
  await createConfirmedUser(partnerEmail, PW, "Davet Ortak");
  await resetAuthRateLimits();

  // Sadece davetle ilan (invite mode) oluştur.
  const rows = await runSql<Array<{ id: string }>>(`
    insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency)
    values ('${sellerId}', 'Davetli Ortaklik Urunu ${E2E_LISTING_TAG}', 'e2e-invite-${Date.now()}', 'Davetle ortaklik akisi testi icin urun aciklamasi yeterince uzun olmalidir.', 5000, 'rate', 15, 'Elektronik', 'İstanbul', 'active', 'invite', 'TRY')
    returning id;`);
  const listingId = rows[0].id;
  const code = inviteCode(listingId, sellerId);

  await login(page, partnerEmail);

  // 1) Kodsuz erişim → "sadece davetle" kapısı; ortak olamaz.
  await page.goto(`/listing/${listingId}`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2500);
  await expect(page.getByText(/sadece davetle/i).first()).toBeVisible({ timeout: 15000 });

  // 2) Geçerli davet linki → "davet edildi" + anında ortak ol.
  await page.goto(`/listing/${listingId}?ortak-davet=${code}`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2500);
  await expect(page.getByText(/davet etti|Hemen Ortak Ol/i).first()).toBeVisible({ timeout: 15000 });
  await page.getByText(/Hemen Ortak Ol ve Kazan/i).first().click();
  await page.waitForTimeout(3500);

  // DB'de aktif ortaklık oluştu mu?
  const parts = await runSql<Array<{ status: string }>>(
    `select status from partnerships where listing_id = '${listingId}';`
  );
  expect(parts.length).toBe(1);
  expect(parts[0].status).toBe("active");

  // Temizlik
  await runSql(`delete from partnerships where listing_id = '${listingId}';`);
  await runSql(`delete from listings where id = '${listingId}';`);
});
