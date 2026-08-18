import { test, devices } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test("mobil ekran görüntüleri 2 — sayfalar + modallar", async ({ page }) => {
  test.setTimeout(240_000);
  const shot = async (name: string, full = false) => { await page.screenshot({ path: `e2e-artifacts/m2-${name}.png`, fullPage: full }); };
  const go = async (path: string, waitMs = 2500) => { await page.goto(`https://ortaksat.com${path}`, { waitUntil: "networkidle" }).catch(() => {}); await page.waitForTimeout(waitMs); };

  await go("/kategori/emlak"); await shot("cat-emlak", true);
  await go("/ortaklar"); await shot("ortaklar", true);
  await go("/ortak-araniyor"); await shot("ortak-araniyor", true);
  await go("/auth"); await shot("auth", true);

  // Explore + FİLTRE alt-sayfası
  await go("/explore");
  const filtre = page.getByText(/Tüm Filtreler|Filtre/).first();
  if (await filtre.count()) { await filtre.tap({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1500); await shot("filter-sheet"); }
  // kapat + sıralama alt-sayfası
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(600);
  const sirala = page.getByText(/^Sırala$/).first();
  if (await sirala.count()) { await sirala.tap({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1200); await shot("sort-sheet"); }

  // Create → mobil kategori seçici (OptionSheet)
  await go("/create");
  await page.getByText(/^Yeni başla/).first().tap({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(700);
  const katSec = page.getByText(/^Kategori seç$/).first();
  if (await katSec.count()) { await katSec.tap({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1200); await shot("cat-picker-sheet"); }
});
