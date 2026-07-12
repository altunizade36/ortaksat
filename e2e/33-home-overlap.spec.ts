import { test } from "@playwright/test";
test("ANA SAYFA MOBİL: çakışan metinler", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const out = await page.evaluate(() => {
    const leaves = Array.from(document.querySelectorAll<HTMLElement>("div,span,p"))
      .filter((e) => e.children.length === 0 && (e.innerText || "").trim().length > 1)
      .map((e) => {
        let sticky = false; let p: HTMLElement | null = e;
        while (p) { const s = getComputedStyle(p); if (s.position === "fixed" || s.position === "sticky") { sticky = true; break; } p = p.parentElement; }
        return { r: e.getBoundingClientRect(), t: (e.innerText || "").trim().slice(0, 24), sticky };
      })
      .filter((o) => o.r.height > 0 && o.r.width > 0 && !o.sticky);
    const hits: string[] = [];
    for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i].r, b = leaves[j].r;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 12 && oy > 12) hits.push(`"${leaves[i].t}" (y${Math.round(a.top)}) X "${leaves[j].t}" (y${Math.round(b.top)})`);
    }
    return [...new Set(hits)].slice(0, 12);
  });
  console.log(`\nÇAKIŞMA: ${out.length}`);
  out.forEach((h) => console.log("  " + h));
});
