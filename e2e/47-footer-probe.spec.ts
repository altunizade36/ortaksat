import { test, devices } from "@playwright/test";
test.use({ ...devices["iPhone 13"] });
test("footer taşma suçlusu", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const out = await page.evaluate(() => {
    const vw = window.innerWidth;
    const el = Array.from(document.querySelectorAll<HTMLElement>("div"))
      .find((d) => (d.innerText || "").trim() === "KVKK uyumlu");
    if (!el) return { err: "bulunamadı", vw };
    const chain: any[] = [];
    let p: HTMLElement | null = el;
    for (let i = 0; i < 6 && p; i++) {
      const r = p.getBoundingClientRect();
      const s = getComputedStyle(p);
      chain.push({
        i, tag: p.tagName.toLowerCase(),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        flexDir: s.flexDirection, wrap: s.flexWrap,
        padL: s.paddingLeft, padR: s.paddingRight, mgL: s.marginLeft, mgR: s.marginRight,
        minW: s.minWidth, txt: (p.innerText || "").trim().slice(0, 22).replace(/\n/g, "|")
      });
      p = p.parentElement;
    }
    return { vw, chain };
  });
  console.log(JSON.stringify(out, null, 1).slice(0, 1800));
});
