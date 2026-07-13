import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

test("ORTAK OL TANI", async ({ page }) => {
  test.setTimeout(600_000);
  const sellerEmail = uniqueEmail("djs");
  const partnerEmail = uniqueEmail("djp");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "DJ Satici");
  const partnerId = await createConfirmedUser(partnerEmail, PW, "DJ Ortak");

  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'DJ ONAY URUN', 'dj-' || substr(md5(random()::text),1,8), 'İstanbul', 't', 'Cep Telefonu', 50000, 'rate', 20, 'active', 5, false, 'approval')
    returning id`);
  const listingId = l!.id;

  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(partnerEmail);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);

  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  // 1) NOTU ÖNCE DOLDUR (buton tıklamadan)
  const noteBox = page.getByPlaceholder(/neden|niçin|kısaca|not/i).first();
  console.log(`not alanı görünür mü: ${await noteBox.isVisible().catch(() => false)}`);
  if (!(await noteBox.isVisible().catch(() => false))) {
    // Form kapalıysa butona basınca açılıyor olabilir
    await page.getByRole("button", { name: /Ortaklık Başvurusu Gönder/i }).first().tap({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
    // modal çıktıysa kapat
    const m = page.getByTestId("alert-confirm");
    if (await m.isVisible().catch(() => false)) { console.log("MODAL ÇIKTI (eksik başvuru) → kapatılıyor"); await m.click(); await page.waitForTimeout(800); }
  }
  const noteBox2 = page.getByPlaceholder(/neden|niçin|kısaca|not/i).first();
  const vis = await noteBox2.isVisible().catch(() => false);
  console.log(`not alanı (2. deneme) görünür mü: ${vis}`);
  if (vis) { await noteBox2.fill("Bu ürünü kitleme satmak istiyorum."); console.log("not dolduruldu"); }

  await page.screenshot({ path: "e2e-artifacts/dj-1-form.png", fullPage: true });

  // 2) GÖNDER
  await page.getByRole("button", { name: /Ortaklık Başvurusu Gönder/i }).first().tap({ timeout: 8000 }).catch((e) => console.log("gönder tap hata: " + e.message.slice(0, 50)));
  await page.waitForTimeout(2500);

  const modal = page.getByTestId("alert-confirm");
  if (await modal.isVisible().catch(() => false)) {
    const body = await page.locator("body").innerText();
    const idx = body.indexOf("Eksik");
    console.log("GÖNDER SONRASI MODAL VAR. Metin:", body.slice(Math.max(0, idx - 40), idx + 120).replace(/\n/g, " | "));
    await modal.click();
    await page.waitForTimeout(1500);
  } else {
    console.log("GÖNDER SONRASI MODAL YOK");
  }
  await page.screenshot({ path: "e2e-artifacts/dj-2-sonra.png", fullPage: true });

  const p = await one<Record<string, unknown>>(`select id, status from partnerships where listing_id='${listingId}' and partner_id='${partnerId}'`);
  console.log(`\n>>> DB ORTAKLIK: ${p ? JSON.stringify(p) : "YOK"}`);
});
