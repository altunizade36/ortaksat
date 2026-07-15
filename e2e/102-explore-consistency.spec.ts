import { test, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/explore-consistency";

// Kart görsellerinin ölçü/oran tutarlılığını ÖLÇ (tahmin değil).
async function measure(page: Page, tag: string, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: false }).catch(() => {});

  const data = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img")).filter((im) => {
      const r = im.getBoundingClientRect();
      return r.width > 80 && r.height > 80 && r.top < window.innerHeight; // kart görselleri
    });
    const dims = imgs.slice(0, 8).map((im) => {
      const r = im.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(2), fit: getComputedStyle(im).objectFit };
    });
    // Kaç sütun? İlk satırdaki kart sayısı (aynı top'a sahip görseller)
    const tops = imgs.map((im) => Math.round(im.getBoundingClientRect().top));
    const firstTop = tops.length ? tops.sort((a, b) => a - b)[0] : 0;
    const cols = tops.filter((t) => Math.abs(t - firstTop) < 20).length;
    return { count: imgs.length, cols, dims, overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
  });
  const ratios = [...new Set(data.dims.map((d) => d.ratio))];
  const fits = [...new Set(data.dims.map((d) => d.fit))];
  console.log(`[${tag} ${w}px] sütun:${data.cols} | görsel:${data.count} | oranlar:${ratios.join(",")} | fit:${fits.join(",")} | taşma:${data.overflow}px | ilk3:${JSON.stringify(data.dims.slice(0, 3))}`);
  return { ratios, fits, cols: data.cols, overflow: data.overflow };
}

test("KEŞFET tutarlılık ölçümü (tüm viewportlar)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await measure(page, "1-mobil-390", 390, 844);
  await measure(page, "2-mobilyatay-640", 640, 800);
  await measure(page, "3-tablet-834", 834, 1112);
  await measure(page, "4-web-1024", 1024, 900);
  await measure(page, "5-web-1440", 1440, 900);
  await ctx.close();
});
