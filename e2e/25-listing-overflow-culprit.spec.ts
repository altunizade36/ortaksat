import { test } from "@playwright/test";

test("İLAN DETAY: 1119px yatay taşmanın suçlusu kim?", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listing/8d1a578e-aa21-4113-882f-848ddbfe7822", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  const out = await page.evaluate((vw) => {
    const rows: Array<Record<string, unknown>> = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right <= vw + 1) return;
      const s = getComputedStyle(el);
      rows.push({
        tag: el.tagName.toLowerCase(),
        w: Math.round(r.width),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: s.width, minWidth: s.minWidth, maxWidth: s.maxWidth,
        flexDirection: s.flexDirection, flexWrap: s.flexWrap,
        position: s.position, overflowX: s.overflowX,
        kids: el.children.length,
        text: (el.innerText || "").trim().slice(0, 34).replace(/\n/g, "|")
      });
    });
    // en geniş olanlar önce
    rows.sort((a, b) => (b.w as number) - (a.w as number));
    return { count: rows.length, top: rows.slice(0, 8) };
  }, 390);

  console.log(`\n=== TAŞAN ÖĞE SAYISI: ${out.count} ===`);
  out.top.forEach((r) => console.log("  " + JSON.stringify(r)));
  await page.screenshot({ path: "e2e-artifacts/listing-overflow.png" });
});
