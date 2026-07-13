import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);
}

async function openListVisible(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const el = document.querySelector('[data-openlist="1"],[data-openloc="1"]') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      kind: el.getAttribute("data-openloc") ? "il/ilçe" : "form-select",
      h: Math.round(r.height),
      visible: Math.round(Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)))
    };
  });
}

/** Sayfadaki tüm "Seçin" kutularını aç → ilk seçeneği seç (formu gerçekten doldur). */
async function fillAllSelects(page: Page) {
  let guard = 0;
  while (guard++ < 20) {
    const box = page.getByText("Seçin", { exact: true }).first();
    if (!(await box.count())) break;
    if (!(await box.isVisible().catch(() => false))) break;
    await box.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);
    if (!(await box.tap({ timeout: 5000 }).then(() => true).catch(() => false))) break;
    await page.waitForTimeout(900);
    const v = await openListVisible(page);
    if (v && v.visible / v.h <= 0.5) console.log(`  !! [doldururken] ${v.kind} görünmüyor (%${Math.round((v.visible / v.h) * 100)})`);
    // açık listedeki ilk seçeneği seç
    const picked = await page.evaluate(() => {
      const el = document.querySelector('[data-openlist="1"]') as HTMLElement | null;
      if (!el) return false;
      const opt = el.querySelector('[role="button"]') as HTMLElement | null;
      if (!opt) return false;
      opt.click();
      return true;
    });
    if (!picked) { await box.tap().catch(() => {}); }
    await page.waitForTimeout(700);
  }
}

/** Zorunlu sayısal/metin alanları doldur. */
async function fillInputs(page: Page) {
  const inputs = await page.locator("input").all();
  for (const inp of inputs) {
    if (!(await inp.isVisible().catch(() => false))) continue;
    const val = await inp.inputValue().catch(() => "x");
    if (val) continue;
    const ph = (await inp.getAttribute("placeholder")) ?? "";
    if (/ara|search|ne satıyorsun/i.test(ph)) continue;
    await inp.fill("2020").catch(() => {});
  }
}

test("iPHONE: formu DOLDUR → Konum adımına geç → il/ilçe seçicilerini test et", async ({ page }) => {
  const email = uniqueEmail("ipadv");
  await createConfirmedUser(email, PW, "E2E iPhone Adv");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1600);
  await page.locator("text=/›/").first().tap();
  await page.waitForTimeout(3000);

  console.log("\n--- Adım 2: tüm seçimleri doldur ---");
  await fillAllSelects(page);
  await fillInputs(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "e2e-artifacts/adv-step2-filled.png" });

  // İleri
  console.log("--- Devam'a bas ---");
  await page.getByText(/^Devam/).first().tap({ timeout: 8000 }).catch(() => console.log("  Devam tıklanamadı"));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e-artifacts/adv-step3.png" });

  const body = await page.locator("body").innerText();
  const onKonum = /İl\b|Tüm iller|İlçe/i.test(body);
  console.log(`Konum adımına geçildi mi? ${onKonum ? "EVET" : "HAYIR"}`);

  if (onKonum) {
    console.log("--- Konum: il/ilçe seçicileri ---");
    let bad = 0, n = 0;
    const pickers = await page.getByText(/İl seç|Tüm iller|İlçe seç|Önce il|Mahalle/i).all();
    for (const p of pickers) {
      if (!(await p.isVisible().catch(() => false))) continue;
      await p.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(250);
      if (!(await p.tap({ timeout: 5000 }).then(() => true).catch(() => false))) continue;
      await page.waitForTimeout(1200);
      n++;
      const v = await openListVisible(page);
      if (v) {
        const ratio = v.visible / v.h;
        if (ratio <= 0.5) { bad++; await page.screenshot({ path: `e2e-artifacts/adv-loc-${n}.png` }); }
        console.log(`${ratio > 0.5 ? "ok" : "!!"} [konum ${n}] ${v.kind} h=${v.h} görünen=${v.visible} (%${Math.round(ratio * 100)})`);
      } else console.log(`?? [konum ${n}] liste bulunamadı`);
      await p.tap({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    console.log(`\n=== KONUM SEÇİCİ SORUNLU: ${bad}/${n} ===`);
  }
});
