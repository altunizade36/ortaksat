import { test, type Page } from "@playwright/test";

const VW = 390;

/** Sayfayı ölç: şişkin sarmalayıcı, yatay taşma, çakışan metin. */
async function audit(page: Page, label: string) {
  const d = await page.evaluate((vw) => {
    const roots: HTMLElement[] = [document.body];
    const divs = Array.from(document.querySelectorAll<HTMLElement>("div"));
    const scrollables = divs.filter((e) => {
      const st = getComputedStyle(e);
      return (st.overflowY === "auto" || st.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 20;
    }).sort((a, b) => b.scrollHeight - a.scrollHeight);
    const sc = scrollables[0] ?? roots[0];

    // şişkin: yükseklik >> doğrudan çocuklarının kapladığı alan
    const bloated: string[] = [];
    sc.querySelectorAll<HTMLElement>("div").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 500) return;
      const kids = Array.from(el.children) as HTMLElement[];
      if (!kids.length) return;
      const bots = kids.map((k) => k.getBoundingClientRect().bottom);
      const tops = kids.map((k) => k.getBoundingClientRect().top);
      const contentH = Math.max(...bots) - Math.min(...tops);
      if (r.height - contentH > 300) bloated.push(`h=${Math.round(r.height)} içerik=${Math.round(contentH)} "${(el.innerText || "").trim().slice(0, 26).replace(/\n/g, "|")}"`);
    });

    // yatay taşma
    let overflowX = 0;
    const offenders: string[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > vw + 1) {
        const over = Math.round(r.right - vw);
        if (over > overflowX) overflowX = over;
        if (el.children.length <= 2 && (el.innerText || "").trim())
          offenders.push(`+${over}px "${(el.innerText || "").trim().slice(0, 24)}"`);
      }
    });

    // çakışan görünür metinler
    const vh = window.innerHeight;
    const leaves = Array.from(document.querySelectorAll<HTMLElement>("div,span,p"))
      .filter((e) => e.children.length === 0 && (e.innerText || "").trim().length > 2)
      .map((e) => ({ r: e.getBoundingClientRect(), t: (e.innerText || "").trim().slice(0, 20) }))
      .filter((o) => o.r.height > 0 && o.r.top < vh && o.r.bottom > 0);
    const overlaps: string[] = [];
    for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i].r, b = leaves[j].r;
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 10 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 10)
        overlaps.push(`"${leaves[i].t}" X "${leaves[j].t}"`);
    }
    return { scrollHeight: sc.scrollHeight, bloated: bloated.slice(0, 4), overflowX, offenders: [...new Set(offenders)].slice(0, 6), overlaps: [...new Set(overlaps)].slice(0, 4) };
  }, VW);

  const bad = d.bloated.length || d.overflowX > 1 || d.overlaps.length;
  console.log(`${bad ? "!!" : "ok"} [${label}] h=${d.scrollHeight} taşma=${d.overflowX}px şişkin=${d.bloated.length} çakışma=${d.overlaps.length}`);
  d.bloated.forEach((b) => console.log("     ŞİŞKİN: " + b));
  d.offenders.forEach((o) => console.log("     TAŞAN: " + o));
  d.overlaps.forEach((o) => console.log("     ÇAKIŞMA: " + o));
  return d;
}

test("MOBİL: ilan detay sayfaları (çok kategori) yerleşim taraması", async ({ page }) => {
  await page.setViewportSize({ width: VW, height: 844 });

  // İlan id'lerini doğrudan public feed'den al (kartlar <a> değil, RN-web Pressable).
  const envRaw = require("fs").readFileSync(require("path").join(__dirname, "..", ".env"), "utf8") as string;
  const pick = (k: string) => (envRaw.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || pick("EXPO_PUBLIC_SUPABASE_URL");
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || pick("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  const res = await fetch(`${url}/rest/v1/listing_public_cards?select=id,category&status=eq.active&limit=40`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const rows: Array<{ id: string; category: string }> = await res.json();
  // kategori çeşitliliği: her kategoriden en fazla 1
  const seen = new Set<string>();
  const picked = rows.filter((r) => (seen.has(r.category) ? false : (seen.add(r.category), true))).slice(0, 10);
  const uniq = picked.map((r) => `/listing/${r.id}`);
  console.log(`\n${uniq.length} ilan (farklı kategori): ${picked.map((p) => p.category).join(", ")}\n`);

  for (const href of uniq) {
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    const d = await audit(page, href.replace("/listing/", "").slice(0, 12));
    if (d.bloated.length || d.overflowX > 1 || d.overlaps.length) {
      await page.screenshot({ path: `e2e-artifacts/L-${href.split("/").pop()?.slice(0, 8)}.png`, fullPage: false });
    }
  }
});
