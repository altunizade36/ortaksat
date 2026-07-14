import { test, expect, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/explore-look";

async function shoot(page: Page, tag: string, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true }).catch(() => {});
}

test("KEŞFET görünüm (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1500 } });
  const page = await ctx.newPage();
  await shoot(page, "d-explore", "/explore");
  // kategori seçili hali (Vasıta) — kategoriye özel filtre var mı?
  await shoot(page, "d-explore-vasita", "/explore?category=Vas%C4%B1ta");
  await ctx.close();
});

test("KEŞFET görünüm (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await shoot(page, "m-explore", "/explore");

  // Kategori filtresi KAPALI başlamalı → çipler görünmemeli; ilk ilan kartı erken gelmeli.
  const catChipVisible = await page.getByText("Yedek Parça, Aksesuar & Tuning").first().isVisible().catch(() => false);
  console.log(`kategori çipi (kapalıyken) görünür mü: ${catChipVisible}`);
  expect(catChipVisible, "kategori çipleri kapalıyken görünmemeli").toBeFalsy();

  // İlk ilan kartı görseli DOM'da olmalı (ilanlar erken)
  const firstCardTop = await page.evaluate(() => {
    const img = document.querySelector('img[src*="/demo/"]') as HTMLElement | null;
    return img ? Math.round(img.getBoundingClientRect().top + window.scrollY) : -1;
  });
  console.log(`ilk ilan kartı Y konumu: ${firstCardTop}px`);
  expect(firstCardTop, "ilk ilan kartı DOM'da olmalı").toBeGreaterThan(0);

  // Başlığa dokun → kategori çipleri açılmalı (işlev korundu)
  await page.getByText("Kategoriye göre filtrele").first().click();
  await page.waitForTimeout(700);
  const catChipAfter = await page.getByText("Yedek Parça, Aksesuar & Tuning").first().isVisible().catch(() => false);
  console.log(`açınca kategori çipi görünür mü: ${catChipAfter}`);
  expect(catChipAfter, "başlığa dokununca çipler açılmalı").toBeTruthy();
  await page.screenshot({ path: `${OUT}/m-explore-opened.png`, fullPage: true }).catch(() => {});

  await ctx.close();
});
