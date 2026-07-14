import { test, devices, type Page } from "@playwright/test";
import fs from "node:fs";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/create-audit";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().click();
  await page.waitForTimeout(5500);
}

/** Adımdaki her etkileşimli öğeyi ve metni döker — "eksik ne" sorusunu koda değil ekrana sordurur. */
async function dump(page: Page, tag: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true }).catch(() => {});
  const info = await page.evaluate(() => {
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const btns = [...document.querySelectorAll('[role="button"], button')]
      .filter(vis).map((b) => (b as HTMLElement).innerText.replace(/\s+/g, " ").trim()).filter(Boolean);
    const inputs = [...document.querySelectorAll("input, textarea")].filter(vis).map((i) => {
      const el = i as HTMLInputElement;
      return `${el.tagName.toLowerCase()}[${el.type || "text"}] ph="${el.placeholder ?? ""}"`;
    });
    return { btns: [...new Set(btns)], inputs };
  });
  console.log(`\n===== ${tag} =====`);
  console.log("GİRDİLER:", info.inputs.length ? info.inputs.join(" | ") : "(yok)");
  console.log("BUTONLAR:", info.btns.join(" · ").slice(0, 900));
}

test("İLAN VERME DENETİMİ (masaüstü)", async ({ browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const email = uniqueEmail("crtaudit");
  await createConfirmedUser(email, PW, "E2E CreateDenetim");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await dump(page, "01-kategori");

  // Kategori: ilk üst kategoriyi seç, yaprağa kadar in
  for (let depth = 0; depth < 4; depth++) {
    const opt = page.getByText(/^(Emlak|Konut|Satılık|Daire)$/).first();
    if (await opt.count().then((c) => c > 0).catch(() => false)) {
      await opt.click().catch(() => {});
      await page.waitForTimeout(1200);
    }
  }
  await dump(page, `02-kategori-secildi`);

  // Sonraki adımlara sırayla geç, her adımı dök
  const names = ["03-ilan-bilgileri", "04-konum", "05-fotograflar", "06-komisyon", "07-onizleme"];
  for (const n of names) {
    const next = page.getByText(/^(Devam|İleri|Sonraki)$/).first();
    if (!(await next.count().then((c) => c > 0).catch(() => false))) break;
    await next.click().catch(() => {});
    await page.waitForTimeout(1500);
    await dump(page, n);
  }

  await ctx.close();
});

test("İLAN VERME DENETİMİ (mobil)", async ({ browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const email = uniqueEmail("crtauditm");
  await createConfirmedUser(email, PW, "E2E CreateDenetimM");
  await login(page, email);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await dump(page, "m01-kategori");
  await ctx.close();
});
