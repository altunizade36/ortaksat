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
    if (/ara|search|ne satıyorsun|mahalle/i.test(ph)) continue;
    await inp.fill("50000").catch(() => {});
  }
  for (const ta of await page.locator("textarea").all()) {
    if (!(await ta.isVisible().catch(() => false))) continue;
    if (await ta.inputValue().catch(() => "x")) continue;
    await ta.fill("Test açıklaması, ürün temiz.").catch(() => {});
  }
}

test("iPHONE: KONUM adımı — İl seçici açılınca liste GÖRÜNÜYOR mu, seçim işleniyor mu?", async ({ page }) => {
  const email = uniqueEmail("konum");
  await createConfirmedUser(email, PW, "E2E Konum");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1600);
  await page.locator("text=/›/").first().tap();
  await page.waitForTimeout(3000);

  await fillSelects(page);
  await fillInputs(page);
  await page.waitForTimeout(600);
  await page.getByText(/^Devam/).first().tap({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const body = await page.locator("body").innerText();
  console.log(`Konum adımında mıyız? ${/İl seçmelisin|İl\b/i.test(body) ? "EVET" : "HAYIR"}`);

  // İl seçicisini aç
  const il = page.getByText(/İl seç|Tüm iller|Şehir seç/i).first();
  const found = await il.count();
  console.log(`İl seçici bulundu mu: ${found > 0}`);
  if (!found) { await page.screenshot({ path: "e2e-artifacts/konum-noil.png" }); return; }

  await il.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await il.tap({ timeout: 8000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/konum-il-open.png" });

  const v = await page.evaluate(() => {
    const vh = window.innerHeight;
    const el = document.querySelector('[data-openloc="1"]') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { h: Math.round(r.height), visible: Math.round(Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))), top: Math.round(r.top), vh: Math.round(vh) };
  });
  if (!v) console.log("!! İl listesi DOM'da bulunamadı (data-openloc yok → düzeltme deploy edilmemiş olabilir)");
  else {
    const ratio = v.visible / v.h;
    console.log(`${ratio > 0.5 ? "ok" : "!!"} İL LİSTESİ: h=${v.h} görünen=${v.visible} (%${Math.round(ratio * 100)}) top=${v.top} vh=${v.vh}`);
  }

  // İstanbul'u seç
  const ist = page.getByText("İstanbul", { exact: true }).first();
  if (await ist.count()) {
    await ist.tap({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: "e2e-artifacts/konum-il-selected.png" });
  const after = await page.locator("body").innerText();
  console.log(`İl seçildi mi (İstanbul)? ${/İstanbul/.test(after) ? "EVET" : "HAYIR"} | hâlâ "İl seçmelisin"? ${/İl seçmelisin/.test(after)}`);
});
