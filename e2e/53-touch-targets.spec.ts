import { test, devices } from "@playwright/test";
test.use({ ...devices["iPhone 13"] });
test("küçük dokunma hedefleri", async ({ page }) => {
  for (const [name, url] of [["ana sayfa", "/"], ["keşfet", "/explore"]] as const) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll<HTMLElement>('[role="button"],a').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.width > 0 && (r.height < 36 || r.width < 36)) {
          const t = (el.innerText || "").trim().slice(0, 24).replace(/\n/g, " ");
          out.push(`${Math.round(r.width)}x${Math.round(r.height)} "${t || "(ikon)"}"`);
        }
      });
      return [...new Set(out)].slice(0, 10);
    });
    console.log(`\n[${name}] küçük hedef: ${small.length}`);
    small.forEach((s) => console.log("   " + s));
  }
});
