import { test, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/explore-audit";

type Probe = { viewport: string; jsErrors: string[]; overflow: number; notes: string[] };

async function audit(page: Page, tag: string, viewport: string): Promise<Probe> {
  const jsErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") jsErrors.push(m.text().slice(0, 140)); });
  page.on("pageerror", (e) => jsErrors.push("PAGEERR: " + String(e).slice(0, 140)));

  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}/${tag}-1-ilk.png`, fullPage: true }).catch(() => {});

  const notes: string[] = [];

  // Yatay taşma var mı?
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return Math.max(0, de.scrollWidth - de.clientWidth);
  });
  if (overflow > 2) notes.push(`yatay taşma: ${overflow}px`);

  // Kaç ilan kartı görünüyor? Tıklanınca ilana gidiyor mu?
  const cardInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('a[href*="/listing/"], [data-testid*="listing"], [role="link"]'));
    const visibleCards = cards.filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 40 && r.height > 40;
    });
    return { total: cards.length, visible: visibleCards.length };
  });
  notes.push(`kart: ${cardInfo.visible} görünür / ${cardInfo.total} toplam`);

  // İlk ilan kartına tıkla — ilana gidiyor mu?
  const before = page.url();
  const firstCard = page.locator('a[href*="/listing/"]').first();
  let navigated = false;
  if (await firstCard.count().then((c) => c > 0).catch(() => false)) {
    await firstCard.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    navigated = page.url().includes("/listing/");
    notes.push(`kart tıklama → ilana gitti: ${navigated} (${page.url().replace(before, "").slice(0, 30)})`);
    await page.screenshot({ path: `${OUT}/${tag}-2-karttiklama.png`, fullPage: true }).catch(() => {});
    await page.goBack().catch(() => {});
    await page.waitForTimeout(2500);
  } else {
    notes.push("TIKLANACAK KART BULUNAMADI");
  }

  // Filtre/kategori açılıyor mu? (kategori çipi / filtre butonu)
  const filterBtn = page.getByText(/Filtrele|Filtre|Kategoriler|Sırala/i).first();
  if (await filterBtn.count().then((c) => c > 0).catch(() => false)) {
    await filterBtn.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${tag}-3-filtre.png`, fullPage: true }).catch(() => {});
    notes.push("filtre butonuna tıklandı");
  } else {
    notes.push("filtre/sırala butonu bulunamadı");
  }

  return { viewport, jsErrors: [...new Set(jsErrors)], overflow, notes };
}

test("KEŞFET denetim (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await audit(await ctx.newPage(), "d", "masaüstü 1440");
  console.log("\n=== MASAÜSTÜ ===\nJS HATA:", p.jsErrors.length ? p.jsErrors.join("\n  ") : "yok", "\nNOTLAR:", p.notes.join(" | "));
  await ctx.close();
});

test("KEŞFET denetim (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await audit(await ctx.newPage(), "m", "mobil iPhone13");
  console.log("\n=== MOBİL ===\nJS HATA:", p.jsErrors.length ? p.jsErrors.join("\n  ") : "yok", "\nNOTLAR:", p.notes.join(" | "));
  await ctx.close();
});

test("KEŞFET denetim (tablet)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 834, height: 1112 } });
  const p = await audit(await ctx.newPage(), "t", "tablet 834");
  console.log("\n=== TABLET ===\nJS HATA:", p.jsErrors.length ? p.jsErrors.join("\n  ") : "yok", "\nNOTLAR:", p.notes.join(" | "));
  await ctx.close();
});
