import { test, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/detail-look";
// Farklı kategorilerden 2 ilan (araç + emlak/ofis) — spec yoğunluğu farklı.
const LISTINGS: Array<[string, string]> = [
  ["b36a5182-3f17-42dc-997c-a176abbd870d", "jetski"],
  ["ebab50d5-95c3-4edb-a1d6-76cd22b9b6fe", "ofis"]
];

async function shoot(page: Page, tag: string) {
  for (const [id, name] of LISTINGS) {
    await page.goto(`/listing/${id}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: true }).catch(() => {});
  }
}

test("İLAN DETAYI görünüm (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  const page = await ctx.newPage();
  await shoot(page, "d");
  await ctx.close();
});

test("İLAN DETAYI görünüm (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await shoot(page, "m");
  await ctx.close();
});
