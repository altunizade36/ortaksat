import { test, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/mobile-interact";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }).catch(() => {});
}
async function ov(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

test("MOBİL KEŞFET kategori ağacı (iPhone 13)", async ({ browser }) => {
  test.setTimeout(150_000);
  const err: string[] = [];
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => err.push("PAGEERR: " + String(e).slice(0, 100)));

  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  // Kategoriye göre filtrele → aç
  await page.getByText(/Kategoriye göre filtrele/i).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, "3-kategori-acik");
  console.log(`[kat açık] taşma:${await ov(page)}px`);

  // Emlak seç
  await page.getByText(/^Emlak$/).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "4-emlak");
  const hasSub = await page.getByText(/Konut|Arsa|İş Yeri|Daire|Bina/).first().count().then((c) => c > 0).catch(() => false);
  const cnt = await page.evaluate(() => (document.body.innerText.match(/(\d+)\s*ilan/) || [])[1] ?? "?");
  console.log(`[emlak] alt-kategori göründü:${hasSub} | ilan:${cnt} | taşma:${await ov(page)}px`);

  // Bir alt kategori seç (varsa)
  const sub = page.getByText(/^Konut$/).first();
  if (await sub.count().then((c) => c > 0).catch(() => false)) {
    await sub.click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "5-konut");
    console.log(`[konut] taşma:${await ov(page)}px | ilan:${await page.evaluate(() => (document.body.innerText.match(/(\d+)\s*ilan/) || [])[1] ?? "?")}`);
  }

  console.log(`JS HATA: ${err.length ? [...new Set(err)].join(" ; ") : "yok"}`);
  await ctx.close();
});

test("MOBİL KEŞFET derin kaydırma dibi (iPhone 13)", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  // Dibe kadar kaydır (birkaç kez, load-more tetiklensin)
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      const sv = Array.from(document.querySelectorAll("div")).find((el) => (getComputedStyle(el).overflowY === "scroll" || getComputedStyle(el).overflowY === "auto") && el.scrollHeight > el.clientHeight + 200) as HTMLElement | undefined;
      if (sv) sv.scrollTop = sv.scrollHeight;
    });
    await page.waitForTimeout(900);
  }
  await shot(page, "6-dip");
  const bottom = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(-160));
  const ovv = await ov(page);
  console.log(`[dip] taşma:${ovv}px | son metin: ...${bottom}`);
  await ctx.close();
});
