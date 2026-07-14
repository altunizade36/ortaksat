import { test, devices, type Page } from "@playwright/test";

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
  await ctx.close();
});
