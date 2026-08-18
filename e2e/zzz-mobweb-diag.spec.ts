import { test, expect } from "@playwright/test";

// Mobil web tarayıcı taraması: 320px (küçük telefon) + 390px (iPhone). Yatay taşma,
// konsol hataları, kritik render eksikleri. SUBMIT yok — salt teşhis.
const PAGES = [
  "/", "/explore", "/kategoriler", "/kategori/emlak", "/create", "/auth",
  "/favorites", "/following", "/notifications", "/offers", "/ortaklar",
  "/(tabs)/profile", "/(tabs)/messages", "/(tabs)/seller", "/(tabs)/partner",
  "/nasil-calisir", "/sss", "/hakkimizda", "/blog", "/trust"
];

for (const width of [320, 390]) {
  test(`mobil-web taşma/hata taraması @${width}px`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height: 780 });
    const rows: string[] = [];
    for (const path of PAGES) {
      const errs: string[] = [];
      const onErr = (m: any) => { if (m.type && m.type() === "error") errs.push(m.text().slice(0, 80)); };
      page.on("console", onErr);
      page.on("pageerror", (e) => errs.push("PE:" + String(e).slice(0, 60)));
      await page.goto(`https://ortaksat.com${path}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(1800);
      const m = await page.evaluate((w) => {
        const de = document.documentElement;
        const overflow = Math.max(de.scrollWidth - w, document.body.scrollWidth - w);
        // taşmaya sebep olan ilk geniş eleman
        let culprit = "";
        if (overflow > 2) {
          const all = Array.from(document.querySelectorAll("*")) as HTMLElement[];
          for (const el of all) {
            const r = el.getBoundingClientRect();
            if (r.right > w + 2 && r.width > 40 && r.width <= w + 60) {
              culprit = (el.tagName + "." + (el.className || "").toString().slice(0, 30)).slice(0, 45);
              break;
            }
          }
        }
        const bodyLen = document.body.innerText.length;
        return { overflow, culprit, bodyLen };
      }, width);
      const crash = await page.locator("body").innerText().then((t) => /ters gitti|Something went wrong/i.test(t));
      const flag = m.overflow > 2 ? `⚠ TAŞMA ${m.overflow}px (${m.culprit})` : "ok";
      const errFlag = errs.length ? ` · ERR:${errs.length}(${errs[0]?.slice(0, 40)})` : "";
      rows.push(`${path.padEnd(22)} ${flag}${crash ? " · ÇÖKTÜ" : ""}${m.bodyLen < 200 ? " · BOŞ" : ""}${errFlag}`);
      page.off("console", onErr);
    }
    console.log(`\n===== @${width}px =====\n` + rows.join("\n"));
  });
}
