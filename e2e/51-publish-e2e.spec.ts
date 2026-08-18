import { test, expect, devices, type Page } from "@playwright/test";
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

test("iPHONE: ilan verme UÇTAN UCA — TEK SAYFA + YAYINLA", async ({ page }) => {
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

  // TEK SAYFA AKIŞ: tüm alanlar aynı sayfada — "Devam" adımı YOK. Hepsini doldur, sonra YAYINLA.
  // Başlığı açıkça doldur ki fillInputs "50000" ile ezmesin.
  const titleInput = page.getByPlaceholder(/kısa ve net başlık|En az .* karakter/i).first();
  if (await titleInput.count()) await titleInput.fill("E2E Otomobil Temiz Bakimli Sahibinden").catch(() => {});
  await page.waitForTimeout(400);

  console.log("--- Form alanları (tek sayfa) ---");
  await fillSelects(page);
  await fillInputs(page);
  await page.waitForTimeout(600);

  // Konum (aynı sayfada)
  console.log("--- Konum ---");
  const il = page.getByText(/İl seçin|Tüm iller/i).first();
  if (await il.count()) {
    await il.scrollIntoViewIfNeeded().catch(() => {});
    await il.tap({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1200);
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

  // Fotoğraf — web'de galeri = tarayıcı dosya seçici → Playwright filechooser ile ver.
  console.log("--- Fotoğraf (filechooser) ---");
  page.on("filechooser", (fc) => { void fc.setFiles("assets/favicon.png").catch(() => {}); });
  const addPhoto = page.getByText("Fotoğraf Ekle", { exact: true }).first();
  if (await addPhoto.count()) {
    await addPhoto.scrollIntoViewIfNeeded().catch(() => {});
    await addPhoto.tap({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(4000);
  } else console.log("  'Fotoğraf Ekle' butonu bulunamadı");

  // DEĞİŞİKLİK #1: İlan Gücü metresi CANLI görünmeli (eskiden showPreviewBlock=false ile ölüydü).
  const bodyMid = await page.locator("body").innerText();
  const meterVisible = /İlan gücü/i.test(bodyMid);
  console.log(`  İLAN GÜCÜ metresi görünür mü: ${meterVisible}`);
  expect(meterVisible, "İlan gücü kalite metresi yayın öncesi görünmeli").toBeTruthy();
  await page.screenshot({ path: "e2e-artifacts/pub-singlepage.png" });

  // YAYINLA — DİKKAT: /Yayınla/ regex'i başka metne de uyabilir; TAM metin "İlanı Yayınla".
  const yayinla = page.getByText("İlanı Yayınla", { exact: true }).first();
  console.log(`  "İlanı Yayınla" butonu var mı: ${(await yayinla.count()) > 0}`);
  await yayinla.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await yayinla.tap({ timeout: 8000 }).catch((e) => console.log("  Yayınla tap hata: " + e.message.slice(0, 50)));
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "e2e-artifacts/pub-sonuc.png" });

  const body7 = await page.locator("body").innerText();
  const eksik = body7.match(/Eksik zorunlu alan[^\n]*/);
  if (eksik) console.log(`  !! yayın engellendi: ${eksik[0].slice(0, 90)}`);
  const basari = /İlanın yayında|incelemeye alındı/.test(body7);
  console.log(`  başarı ekranı çıktı mı: ${basari}`);
  expect(basari, "yayından sonra başarı ekranı görünmeli").toBeTruthy();

  const linkGorunur = /ortaksat\.com\/listing\//.test(body7);
  console.log(`  gerçek ilan linki görünür mü: ${linkGorunur}`);
  expect(linkGorunur, "başarı ekranında gerçek ilan linki olmalı").toBeTruthy();

  // DB'de gerçekten oluştu mu (teardown silmeden önce)?
  const dbRows = await runSql<Array<Record<string, unknown>>>(
    "select id, left(title,24) title, status, price from listings l where created_at > now() - interval '10 minutes' order by created_at desc limit 2"
  ).catch((e) => [{ err: String(e).slice(0, 80) }]);
  console.log("  DB'DEKİ YENİ İLAN:", JSON.stringify(dbRows));
  expect(Array.isArray(dbRows) && dbRows.length > 0 && !("err" in dbRows[0]), "ilan DB'de olmalı").toBeTruthy();
});
