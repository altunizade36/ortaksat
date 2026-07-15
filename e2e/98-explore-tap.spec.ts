import { test, expect, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/explore-tap";

async function tapFirstCard(page: Page, tag: string) {
  const jsErr: string[] = [];
  page.on("pageerror", (e) => jsErr.push(String(e).slice(0, 120)));
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  const before = page.url();
  // Görünür bir ilan başlığına dokun (kartın kendisi)
  const card = page.getByText(/Sony Alpha|Cadde Üstü|Jet Ski|Bluetooth|Deniz|Villa|iPhone|Samsung/).first();
  const found = await card.count().then((c) => c > 0).catch(() => false);
  let dest = "?";
  if (found) {
    await card.click({ timeout: 6000 }).catch((e) => jsErr.push("click: " + e.message.slice(0, 60)));
    await page.waitForTimeout(3500);
    dest = page.url().replace("https://www.ortaksat.com", "").slice(0, 45);
    await page.screenshot({ path: `${OUT}/${tag}-tiklama-sonrasi.png`, fullPage: true }).catch(() => {});
  }
  console.log(`[${tag}] kart bulundu:${found} | tıklama sonrası → ${dest} | JS hata: ${jsErr.length ? jsErr.join("; ") : "yok"}`);
  // Her iki platformda da ürüne dokunma İLAN SAYFASINA gitmeli (tutarlı).
  expect(dest.includes("/listing/"), `${tag}: kart tıklama /listing/'e gitmeli (explore-feed değil)`).toBeTruthy();
  return { found, dest, jsErr };
}

test("KEŞFET tıklama (mobil)", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  await tapFirstCard(await ctx.newPage(), "mobil");
  await ctx.close();
});

test("KEŞFET tıklama (masaüstü)", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await tapFirstCard(await ctx.newPage(), "masaustu");
  await ctx.close();
});
