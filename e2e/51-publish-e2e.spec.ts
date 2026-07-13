import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

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

/** Yerleşim denetimi: yatay taşma + açık listenin görünürlüğü. */
async function audit(page: Page, step: string) {
  const d = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const overflow = document.documentElement.scrollWidth - vw;
    const el = document.querySelector('[data-openlist="1"],[data-openloc="1"]') as HTMLElement | null;
    let list: string | null = null;
    if (el) {
      const r = el.getBoundingClientRect();
      const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      list = `liste %${Math.round((vis / r.height) * 100)} görünür`;
    }
    return { overflow, list };
  });
  console.log(`${d.overflow > 1 ? "!!" : "ok"} [${step}] taşma=${d.overflow}${d.list ? " | " + d.list : ""}`);
}

/** Görünen tüm "Seçin" kutularını gerçek dokunmayla doldur. */
async function fillSelects(page: Page) {
  for (let g = 0; g < 25; g++) {
    const box = page.getByText("Seçin", { exact: true }).first();
    if (!(await box.count()) || !(await box.isVisible().catch(() => false))) return;
    await box.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);
    if (!(await box.tap({ timeout: 5000 }).then(() => true).catch(() => false))) return;
    await page.waitForTimeout(900);
    const optText = await page.evaluate(() => {
      const el = document.querySelector('[data-openlist="1"]') as HTMLElement | null;
      if (!el) return null;
      const rows = (Array.from(el.querySelectorAll("div")) as HTMLElement[]).filter((d) => {
        const t = d.innerText?.trim() ?? "";
        return t.length > 0 && t.length < 40 && d.getBoundingClientRect().height > 20;
      });
      return rows.length ? rows[rows.length - 1].innerText.trim().split("\n")[0] : null;
    });
    if (optText) await page.locator('[data-openlist="1"]').getByText(optText, { exact: true }).first().tap({ timeout: 5000 }).catch(() => {});
    else await box.tap().catch(() => {});
    await page.waitForTimeout(700);
  }
}

async function fillInputs(page: Page) {
  for (const inp of await page.locator("input").all()) {
    if (!(await inp.isVisible().catch(() => false))) continue;
    if (await inp.inputValue().catch(() => "x")) continue;
    const ph = (await inp.getAttribute("placeholder")) ?? "";
    if (/ara|search|ne satıyorsun|mahalle|görsel adresi|http/i.test(ph)) continue;
    await inp.fill("50000").catch(() => {});
  }
  for (const ta of await page.locator("textarea").all()) {
    if (!(await ta.isVisible().catch(() => false))) continue;
    if (await ta.inputValue().catch(() => "x")) continue;
    await ta.fill("E2E test ilanı. Ürün temiz ve bakımlıdır, detaylar için mesaj atabilirsiniz.").catch(() => {});
  }
}

test("iPHONE: ilan verme UÇTAN UCA — 6 adım + YAYINLA", async ({ page }) => {
  test.setTimeout(600_000);
  page.on("console", (m) => { if (m.type() === "error") console.log("  BROWSER-ERR:", m.text().slice(0, 110)); });

  const email = uniqueEmail("publish");
  await createConfirmedUser(email, PW, "E2E Publish");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.getByText(/^Yeni başla/).first().tap({ timeout: 4000 }).catch(() => {}); // varsa taslağı at
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1600);
  await page.locator("text=/›/").first().tap();
  await page.waitForTimeout(3000);

  // --- ADIM 2: İlan bilgileri ---
  console.log("\n--- ADIM 2: İlan Bilgileri ---");
  await audit(page, "adım2");
  await fillSelects(page);
  await fillInputs(page);
  await page.waitForTimeout(600);
  await page.getByText(/^Devam/).first().tap({ timeout: 8000 });
  await page.waitForTimeout(3000);

  // --- ADIM 3: Konum ---
  console.log("--- ADIM 3: Konum ---");
  await audit(page, "adım3");
  const il = page.getByText(/İl seçin|Tüm iller/i).first();
  if (await il.count()) {
    await il.scrollIntoViewIfNeeded().catch(() => {});
    await il.tap({ timeout: 6000 });
    await page.waitForTimeout(1200);
    await audit(page, "adım3/il-listesi");
    await page.getByText("İstanbul", { exact: true }).first().tap({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const ilce = page.getByText(/İlçe seçin/i).first();
  if (await ilce.count()) {
    await ilce.scrollIntoViewIfNeeded().catch(() => {});
    await ilce.tap({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const opt = page.locator('[data-openloc="1"]').getByRole("button").nth(1);
    await opt.tap({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: "e2e-artifacts/pub-3-konum.png" });
  await page.getByText(/^Devam/).first().tap({ timeout: 8000 }).catch(() => console.log("  Devam(3) tıklanamadı"));
  await page.waitForTimeout(3000);

  // --- ADIM 4: Fotoğraflar ---
  console.log("--- ADIM 4: Fotoğraflar ---");
  await audit(page, "adım4");
  // web'de kamera yok → görsel adresi yapıştır
  const urlInput = page.getByPlaceholder(/https|görsel adresi/i).first();
  if (await urlInput.count()) {
    await urlInput.fill("https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200");
    await page.waitForTimeout(400);
    await page.getByText(/^Ekle/).first().tap({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
  } else console.log("  görsel-url alanı bulunamadı");
  await page.screenshot({ path: "e2e-artifacts/pub-4-foto.png" });
  await page.getByText(/^Devam/).first().tap({ timeout: 8000 }).catch(() => console.log("  Devam(4) tıklanamadı"));
  await page.waitForTimeout(3000);

  // --- ADIM 5: Komisyon ---
  console.log("--- ADIM 5: Komisyon & Ortak Satış ---");
  await audit(page, "adım5");
  await fillSelects(page);
  await fillInputs(page);
  await page.screenshot({ path: "e2e-artifacts/pub-5-komisyon.png" });
  await page.getByText(/^Devam/).first().tap({ timeout: 8000 }).catch(() => console.log("  Devam(5) tıklanamadı"));
  await page.waitForTimeout(3000);

  // --- ADIM 6: Önizleme & Yayınla ---
  console.log("--- ADIM 6: Önizleme & Yayınla ---");
  await audit(page, "adım6");
  const body6 = await page.locator("body").innerText();
  const warn = body6.match(/Eksik zorunlu alan[^\n]*/);
  if (warn) console.log(`  !! ${warn[0].slice(0, 90)}`);
  await page.screenshot({ path: "e2e-artifacts/pub-6-onizleme.png" });

  // DİKKAT: /Yayınla/ regex'i ADIM ÇİPİNE ("Önizleme & Yayınla") de uyuyor → önceki denemede
  // çipe dokunup "yayınlandı" sanmıştım (yanlış pozitif). Butonun TAM metni: "İlanı Yayınla".
  const yayinla = page.getByText("İlanı Yayınla", { exact: true }).first();
  console.log(`  "İlanı Yayınla" butonu var mı: ${(await yayinla.count()) > 0}`);
  await yayinla.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await yayinla.tap({ timeout: 8000 }).catch((e) => console.log("  Yayınla tap hata: " + e.message.slice(0, 50)));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "e2e-artifacts/pub-7-sonuc.png" });

  // Kullanıcının asıl sorusu: "ilanım yayınlandı mı?" → panel GERÇEKTEN gösteriyor mu?
  console.log(`\nurl=${page.url().slice(0, 75)}`);
  const aktifSayisi = async () => {
    const n = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("div"));
      const lbl = els.find((e) => (e.innerText || "").trim() === "Aktif ilan");
      const card = lbl?.parentElement;
      const m = (card?.innerText || "").match(/(\d+)/);
      return m ? m[1] : "?";
    });
    return n;
  };
  // DB'DEKİ GERÇEK DURUM (teardown silmeden önce): ilan hangi status ile oluştu?
  const dbRows = await runSql<Array<Record<string, unknown>>>(
    "select id, left(title,24) title, status, owner_id, price, province_id, (select count(*) from listing_images i where i.listing_id=l.id) imgs from listings l where created_at > now() - interval '10 minutes' order by created_at desc limit 2"
  ).catch((e) => [{ err: String(e).slice(0, 80) }]);
  console.log("  DB'DEKİ YENİ İLAN:", JSON.stringify(dbRows));

  console.log(`  yönlendirme sonrası: aktifİlan=${await aktifSayisi()}`);
  await page.waitForTimeout(6000);
  console.log(`  +6sn bekleyince:     aktifİlan=${await aktifSayisi()}`);
  await page.screenshot({ path: "e2e-artifacts/pub-8-panel.png" });

  // AYIRT EDİCİ TEST: sayfayı YENİLE → sunucudan taze veri gelir.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  console.log(`  SAYFA YENİLENİNCE:   aktifİlan=${await aktifSayisi()}`);
  await page.screenshot({ path: "e2e-artifacts/pub-9-panel-reload.png" });
});
