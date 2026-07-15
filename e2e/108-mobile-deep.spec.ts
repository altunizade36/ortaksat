import { test, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/mobile-deep";

test("MOBİL KEŞFET derin bakış (iPhone 13)", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  // TAM SAYFA (baştan sona)
  await page.screenshot({ path: `${OUT}/1-tamsayfa.png`, fullPage: true }).catch(() => {});

  // "Filtre" panelini aç
  const filtreBtn = page.getByText(/^Filtre$/).first();
  if (await filtreBtn.count().then((c) => c > 0).catch(() => false)) {
    await filtreBtn.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/2-filtre-panel.png`, fullPage: true }).catch(() => {});
    const ov = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    console.log(`Filtre panel açık — taşma: ${ov}px`);
    await filtreBtn.click().catch(() => {}); // kapat
    await page.waitForTimeout(500);
  }

  // Kategori filtresini aç + bir kategori seç
  const catBtn = page.getByText(/Kategoriye göre filtrele/i).first();
  if (await catBtn.count().then((c) => c > 0).catch(() => false)) {
    await catBtn.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/3-kategori-acik.png`, fullPage: true }).catch(() => {});
    // Bir kategori seç (Emlak)
    const emlak = page.getByText(/^Emlak$/).first();
    if (await emlak.count().then((c) => c > 0).catch(() => false)) {
      await emlak.click().catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/4-emlak-secili.png`, fullPage: true }).catch(() => {});
      const ov = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      console.log(`Emlak seçili — taşma: ${ov}px`);
    }
  }

  // Stat çipleri kırpılıyor mu — metin ölç
  const stats = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const t = (el as HTMLElement).innerText?.trim() ?? "";
      if (/\.\.\.$/.test(t) && t.length < 20) out.push(t); // "..." ile biten (kırpık) kısa metinler
    }
    return [...new Set(out)].slice(0, 10);
  });
  console.log(`KIRPIK METİNLER: ${stats.length ? stats.join(" | ") : "yok"}`);
  await ctx.close();
});
