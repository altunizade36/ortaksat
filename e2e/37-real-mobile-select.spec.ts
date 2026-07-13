import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

// GERÇEK mobil emülasyon: isMobile + hasTouch + mobil UA + DPR.
// (Önceki testlerim masaüstü Chromium'u 390px'e daraltıyordu — gerçek telefon webi DEĞİL.)
test.use({ ...devices["iPhone SE"] }); // KISA EKRAN (375x667)

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);
}

async function listVisibility(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const el = document.querySelector('[data-openlist="1"]') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      h: Math.round(r.height),
      visible: Math.round(Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))),
      top: Math.round(r.top),
      vh: Math.round(vh)
    };
  });
}

test("GERÇEK MOBİL (Pixel 5, dokunmatik): ilan ver seçim listeleri görünür mü?", async ({ page }) => {
  const vp = page.viewportSize();
  console.log(`\nviewport=${vp?.width}x${vp?.height} touch=evet mobilUA=evet\n`);

  const email = uniqueEmail("realmob");
  await createConfirmedUser(email, PW, "E2E RealMobile");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1600);
  await page.locator("text=/›/").first().tap();
  await page.waitForTimeout(3000);

  const count = await page.getByText("Seçin", { exact: true }).count();
  console.log(`${count} seçim kutusu\n`);

  let bad = 0;
  for (let i = 0; i < count; i++) {
    const box = page.getByText("Seçin", { exact: true }).nth(i);
    if (!(await box.count())) break;
    await box.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    // GERÇEK DOKUNMA (tap), fare tıklaması değil
    if (!(await box.tap({ timeout: 6000 }).then(() => true).catch(() => false))) { console.log(`?? [${i}] tap edilemedi`); continue; }
    await page.waitForTimeout(1300);

    const v = await listVisibility(page);
    if (!v) { console.log(`?? [${i}] liste açılmadı/bulunamadı`); bad++; await page.screenshot({ path: `e2e-artifacts/rm-${i}.png` }); }
    else {
      const ratio = v.h ? v.visible / v.h : 0;
      const ok = ratio > 0.5;
      if (!ok) { bad++; await page.screenshot({ path: `e2e-artifacts/rm-${i}.png` }); }
      console.log(`${ok ? "ok" : "!!"} [${i}] h=${v.h} görünen=${v.visible} (%${Math.round(ratio * 100)}) top=${v.top} vh=${v.vh}`);
    }
    await box.tap({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  console.log(`\n=== GERÇEK MOBİLDE SORUNLU: ${bad}/${count} ===`);
});
