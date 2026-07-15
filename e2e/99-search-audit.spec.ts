import { test, expect, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/search-audit";

async function search(page: Page, tag: string, term: string) {
  const jsErr: string[] = [];
  page.on("pageerror", (e) => jsErr.push(String(e).slice(0, 100)));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  // Arama kutusuna yaz + gönder
  const box = page.getByPlaceholder(/ara/i).first();
  const hasBox = await box.count().then((c) => c > 0).catch(() => false);
  if (!hasBox) { console.log(`[${tag}] ARAMA KUTUSU BULUNAMADI`); return; }
  await box.click();
  await box.fill(term);
  await page.waitForTimeout(600);
  await box.press("Enter");
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${tag}-${term}.png`, fullPage: true }).catch(() => {});

  const info = await page.evaluate((q) => {
    const body = document.body.innerText;
    const url = location.href;
    // GERÇEK sonuç sinyali: Sony ürün başlıkları kaç kez geçiyor (kart sayısı).
    const sonyCards = (body.match(/Sony /g) || []).length;
    const noResult = /sonuç bulunamadı|bulunamadı|eşleşen ilan yok|aramanı daralt/i.test(body);
    return { url: url.replace("https://www.ortaksat.com", ""), sonyCards, noResult, hasQ: url.includes("q=") };
  }, term);
  console.log(`[${tag}] "${term}" → url:${info.url.slice(0, 40)} | q geçti:${info.hasQ} | Sony-kart:${info.sonyCards} | boş-sonuç:${info.noResult} | JS:${jsErr.length ? jsErr.join(";") : "yok"}`);
  if (term === "Sony") {
    expect(info.hasQ, `${tag}: arama q parametresi URL'de olmalı`).toBeTruthy();
    expect(info.sonyCards, `${tag}: "Sony" araması Sony ürünleri getirmeli`).toBeGreaterThanOrEqual(2);
    expect(info.noResult, `${tag}: "Sony" eşleşmesinde boş-sonuç OLMAMALI`).toBeFalsy();
    expect(jsErr.length, `${tag}: aramada JS hatası olmamalı`).toBe(0);
  }
  if (term.startsWith("asdf")) {
    expect(info.noResult, `${tag}: anlamsız aramada boş-sonuç durumu görünmeli`).toBeTruthy();
  }
}

test("ARAMA denetim (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await search(page, "d", "Sony");        // eşleşmeli (Sony Alpha demo ilanı var)
  await search(page, "d", "asdfqwerzxcv"); // boş sonuç
  await ctx.close();
});

test("ARAMA denetim (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await search(page, "m", "Sony");
  await ctx.close();
});
