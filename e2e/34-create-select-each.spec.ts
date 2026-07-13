import { test, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const VW = 390;

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().click();
  await page.waitForTimeout(5000);
}

/** Açık dropdown SEÇENEKLERİ gerçekten tıklanabilir mi (üstte mi), yoksa başka öğe mi kaplıyor? */
async function checkOpenDropdown(page: Page) {
  return page.evaluate(() => {
    // Açık liste: "Seçin" pressable'ının hemen altındaki, çok satırlı kutu.
    // Basitleştir: görünür tüm option satırlarını bul (borderBottom'lu, kısa metinli tıklanabilirler).
    const problems: string[] = [];
    // 1) viewport dışına taşan açık liste var mı?
    const vw = window.innerWidth, vh = window.innerHeight;
    // 2) elementFromPoint ile üstte mi kontrolü: her görünür option'ın merkezinde kendisi mi var?
    const opts = Array.from(document.querySelectorAll<HTMLElement>('[role="button"]'))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        const t = (e.innerText || "").trim();
        return r.height > 20 && r.height < 60 && r.width > 150 && t.length > 0 && t.length < 40 && r.top > 0 && r.bottom < vh;
      });
    let covered = 0, offscreen = 0;
    for (const o of opts) {
      const r = o.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cx > vw || cy < 0 || cy > vh) { offscreen++; continue; }
      const top = document.elementFromPoint(cx, cy);
      if (top && !o.contains(top) && !top.contains(o)) covered++;
    }
    if (covered > 0) problems.push(`ÜSTÜ KAPALI seçenek: ${covered}`);
    if (offscreen > 0) problems.push(`EKRAN DIŞI seçenek: ${offscreen}`);
    // 3) yatay taşma
    const ox = document.documentElement.scrollWidth - vw;
    if (ox > 1) problems.push(`yatay taşma ${ox}px`);
    return problems;
  });
}

test("İLAN VER: her seçim (select) tek tek açılıp kontrol edilir", async ({ page }) => {
  await page.setViewportSize({ width: VW, height: 844 });
  const email = uniqueEmail("selall");
  await createConfirmedUser(email, PW, "E2E SelAll");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2800);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1400);
  await page.locator("text=/›/").first().click();
  await page.waitForTimeout(2800);

  // Formdaki tüm "Seçin" kutularını bul
  const count = await page.getByText("Seçin", { exact: true }).count();
  console.log(`\nFormda ${count} adet seçim kutusu bulundu\n`);

  let bad = 0;
  for (let i = 0; i < count; i++) {
    const box = page.getByText("Seçin", { exact: true }).nth(i);
    if (!(await box.count())) break;
    const label = await box.evaluate((e) => {
      // en yakın üstteki etiket metnini bul
      let p: HTMLElement | null = e.parentElement;
      for (let k = 0; k < 4 && p; k++) { const t = (p.innerText || "").split("\n")[0]?.trim(); if (t && t !== "Seçin") return t.slice(0, 26); p = p.parentElement; }
      return `#${e ? "?" : "?"}`;
    }).catch(() => `#${i}`);

    await box.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    const opened = await box.click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!opened) { console.log(`?? [${i}] ${label}: açılamadı`); continue; }
    await page.waitForTimeout(700);

    const problems = await checkOpenDropdown(page);
    await page.screenshot({ path: `e2e-artifacts/sel-${i}.png` });   // HER açık dropdown'ı çek
    if (problems.length) { bad++; console.log(`!! [${i}] ${label}: ${problems.join(" | ")}`); }
    else console.log(`ok [${i}] ${label}`);
    // kapat
    await box.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  console.log(`\n=== SORUNLU SEÇİM KUTUSU: ${bad}/${count} ===`);
});
