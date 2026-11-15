import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

/**
 * "MESAJ GÖNDER" OTOMATİK MESAJ YOLLAMAZ.
 *
 * Eskiden ilan sayfasında "Mesaj gönder"e basınca kullanıcı adına hazır bir cümle ("… ilanı için bilgi almak
 * istiyorum. Fiyat, stok ve teslimat detayları güncel mi?") gönderiliyordu. Beklenen: sohbet BOŞ açılır, başlangıç
 * önerileri görünür, öneriye dokunmak yalnız yazı kutusunu doldurur ve mesaj ancak kullanıcı gönderince yazılır.
 */
const PW = "GucluSifre123!";
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];
const messageCount = async (listingId: string) => Number((await one<{ n: number }>(`select count(*)::int as n from messages where listing_id='${listingId}'`))?.n ?? 0);

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByRole("button", { name: "E-posta ile giriş yap" }).last().click();
  await page.waitForTimeout(5500);
}

async function seed(tag: string) {
  const sellerId = await createConfirmedUser(uniqueEmail(`${tag}seller`), PW, "E2E Otomesaj Satici");
  const buyerEmail = uniqueEmail(`${tag}buyer`);
  await createConfirmedUser(buyerEmail, PW, "E2E Otomesaj Alici");
  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'E2E OTOMESAJ URUNU', 'e2e-auto-' || substr(md5(random()::text),1,8), 'İstanbul',
            'Otomatik mesaj testi için yeterince uzun bir ürün açıklaması.', 'Cep Telefonu', 30000, 'rate', 10, 'active', 5, false, 'open')
    returning id`);
  return { buyerEmail, listingId: l!.id };
}

for (const [name, viewport] of [["telefon", devices["iPhone 13"].viewport], ["masaüstü", { width: 1366, height: 860 }]] as const) {
  test(`mesaj gönder otomatik mesaj yollamaz (${name})`, async ({ browser }) => {
    test.setTimeout(300_000);
    const { buyerEmail, listingId } = await seed(name === "telefon" ? "autom" : "autod");
    const ctx = await browser.newContext({ viewport, locale: "tr-TR", isMobile: name === "telefon", hasTouch: name === "telefon" });
    await ctx.addInitScript(() => { try { localStorage.setItem("ortaksat.cookieConsent.v1", JSON.stringify({ v: 1, analytics: false, marketing: false, at: "t" })); } catch {} });
    const page = await ctx.newPage();
    page.on("dialog", (d) => d.accept().catch(() => {}));
    await login(page, buyerEmail);
    await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);

    const button = page.getByRole("button", { name: /Mesaj gönder|Satıcıya mesaj|Mesaj at/i }).first();
    await button.scrollIntoViewIfNeeded().catch(() => {});
    await button.click();
    // Sohbet açıldı ve başlangıç önerileri görünüyor.
    await expect(page.getByTestId("chat-starters")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2500);
    expect(await messageCount(listingId), "düğmeye basınca sunucuya mesaj yazılmamalı").toBe(0);
    await expect(page.getByText(/bilgi almak istiyorum/)).toHaveCount(0);

    // Öneriye dokunmak yalnız kutuyu doldurur; göndermez.
    await page.getByText("Merhaba, ilan hâlâ güncel mi?", { exact: true }).first().click();
    await page.waitForTimeout(1500);
    const composer = page.locator("textarea, input").filter({ hasNot: page.locator("[type=search]") }).last();
    const filled = await page.evaluate(() => [...document.querySelectorAll("textarea, input")].some((el) => (el as HTMLInputElement).value === "Merhaba, ilan hâlâ güncel mi?"));
    expect(filled, "öneri yazı kutusuna yazılmalı").toBe(true);
    expect(await messageCount(listingId), "öneriye dokunmak mesaj göndermemeli").toBe(0);
    await page.screenshot({ path: `e2e-artifacts/auto-message/${name}-taslak.png` });

    // Uzun mesajda yazı kutusu büyür (eskiden tek satırda kalıp yalnız son satırı gösteriyordu).
    const box = page.getByTestId("message-composer").last();
    const shortHeight = await box.evaluate((el) => el.getBoundingClientRect().height);
    await box.fill(["birinci satır", "ikinci satır", "üçüncü satır", "dördüncü satır"].join("\n"));
    await page.waitForTimeout(600);
    const tallHeight = await box.evaluate((el) => el.getBoundingClientRect().height);
    expect(tallHeight, "dört satırlık mesajda kutu uzamalı").toBeGreaterThan(shortHeight + 20);
    expect(await messageCount(listingId)).toBe(0);
    await box.fill("Merhaba, ilan hâlâ güncel mi?");
    await page.waitForTimeout(400);

    // Kullanıcı kendisi gönderince TEK mesaj yazılır.
    await composer.press("Enter").catch(() => {});
    await page.waitForTimeout(800);
    if ((await messageCount(listingId)) === 0) await page.getByRole("button", { name: /^(Mesaj gönder|Gönder)$/i }).last().click().catch(() => {});
    await expect.poll(() => messageCount(listingId), { timeout: 20_000 }).toBe(1);
    const row = await one<{ body: string }>(`select body from messages where listing_id='${listingId}'`);
    expect(row?.body).toBe("Merhaba, ilan hâlâ güncel mi?");
    await page.screenshot({ path: `e2e-artifacts/auto-message/${name}-gonderildi.png` });
    await ctx.close();
  });
}
