import { test, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/store-look";
const STORE = "f3ed367b-bf42-46c8-95a6-ac8bc284dcd3";

async function shoot(page: Page, tag: string) {
  await page.goto(`/store/${STORE}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true }).catch(() => {});
}

test("MAĞAZA görünüm (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const page = await ctx.newPage();
  await shoot(page, "d-store");
  await ctx.close();
});

test("MAĞAZA görünüm (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await shoot(page, "m-store");
  await ctx.close();
});
