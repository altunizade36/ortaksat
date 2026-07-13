import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] }); // GERÇEK Safari/WebKit + dokunmatik + mobil UA

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);
}

/** Açık olan HERHANGİ bir liste (form select | il/ilçe | mahalle) görünür mü? */
async function anyOpenListVisible(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const el = document.querySelector('[data-openlist="1"],[data-openloc="1"],[data-openselect="1"]') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      kind: el.getAttribute("data-openlist") ? "form-select" : el.getAttribute("data-openloc") ? "il/ilce" : "attr-select",
      h: Math.round(r.height),
      visible: Math.round(Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)))
    };
  });
}

async function tapAllPickers(page: Page, label: string) {
  // Sayfadaki tüm açılır seçicileri sırayla dokun-aç-kontrol et
  const targets = [
    ...(await page.getByText("Seçin", { exact: true }).all()),
    ...(await page.getByText(/Tüm iller|İl seç|Önce il seçin|İlçe seç|Mahalle/i).all())
  ];
  let bad = 0, n = 0;
  for (const t of targets) {
    if (!(await t.isVisible().catch(() => false))) continue;
    await t.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(250);
    if (!(await t.tap({ timeout: 5000 }).then(() => true).catch(() => false))) continue;
    await page.waitForTimeout(1200);
    const v = await anyOpenListVisible(page);
    n++;
    if (v) {
      const ratio = v.h ? v.visible / v.h : 0;
      if (ratio <= 0.5) {
        bad++;
        console.log(`  !! [${label}] ${v.kind}: h=${v.h} görünen=${v.visible} (%${Math.round(ratio * 100)})`);
        await page.screenshot({ path: `e2e-artifacts/ip-${label}-${n}.png` });
      }
    }
    await t.tap({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  console.log(`${bad ? "!!" : "ok"} [${label}] ${n} seçici denendi, sorunlu=${bad}`);
  return bad;
}

test("iPHONE: ilan ver — tüm adımlardaki tüm seçiciler", async ({ page }) => {
  const email = uniqueEmail("ipfull");
  await createConfirmedUser(email, PW, "E2E iPhone");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1600);
  await page.locator("text=/›/").first().tap();
  await page.waitForTimeout(3000);

  let total = 0;
  total += await tapAllPickers(page, "2-IlanBilgileri");

  // Konum adımı (il/ilçe seçicileri burada!)
  await page.getByText(/Konum/).first().tap({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  total += await tapAllPickers(page, "3-Konum");

  // Komisyon adımı
  await page.getByText(/Komisyon & Ortak Satış/).first().tap({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  total += await tapAllPickers(page, "5-Komisyon");

  console.log(`\n=== iPHONE TOPLAM SORUNLU SEÇİCİ: ${total} ===`);
});
