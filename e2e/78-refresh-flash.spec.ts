import { test, devices } from "@playwright/test";
import fs from "node:fs";

/**
 * YENİLEME FLAŞI TEŞHİSİ: yenilemeden sonraki ilk saniyeyi kare kare yakalar.
 * "Arkada saçma sapan şeyler / başka sayfalar çıkıyor" şikayetinin NE olduğunu görürüz.
 */
const SHOTS = [0, 120, 250, 400, 600, 900, 1400, 2200];
const OUT = "e2e-artifacts/refresh-frames";

async function capture(page: import("@playwright/test").Page, url: string, tag: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // oturum "booted" olsun (gerçek yenileme senaryosu)

  const t0 = Date.now();
  const nav = page.reload({ waitUntil: "commit" });
  for (const ms of SHOTS) {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${tag}-${String(ms).padStart(4, "0")}ms.png` }).catch(() => {});
    const info = await page.evaluate(() => {
      const root = document.getElementById("root") || document.body;
      const txt = (root.innerText || "").replace(/\s+/g, " ").trim().slice(0, 90);
      const splash = document.getElementById("boot-splash");
      return {
        splash: splash ? getComputedStyle(splash).display !== "none" : false,
        w: window.innerWidth,
        txt
      };
    }).catch(() => null);
    console.log(`${tag} @${ms}ms  splash=${info?.splash} | ${info?.txt ?? "-"}`);
  }
  await nav.catch(() => {});
}

test("YENİLEME: mobil ana sayfa", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await capture(page, "/", "mobil-ana");
  await ctx.close();
});

test("YENİLEME: masaüstü ana sayfa", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await capture(page, "/", "web-ana");
  await ctx.close();
});

test("YENİLEME: mobil keşfet", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await capture(page, "/explore", "mobil-kesfet");
  await ctx.close();
});
