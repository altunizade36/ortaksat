import { test, type Page } from "@playwright/test";

const VW = 390;

/** GERÇEK yerleşim hataları: yatay scroll konteynerlerinin İÇİ hariç. */
async function audit(page: Page, label: string) {
  const d = await page.evaluate((vw) => {
    const inHScroll = (el: HTMLElement) => {
      let p: HTMLElement | null = el.parentElement;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (s.overflowX === "auto" || s.overflowX === "scroll") return true;
        p = p.parentElement;
      }
      return false;
    };

    // 1) GERÇEK sayfa yatay taşması
    const pageOverflowX = document.documentElement.scrollWidth - vw;

    // 2) Yatay-scroll DIŞINDA viewport'u aşan öğeler
    const offenders: string[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right <= vw + 1) return;
      if (inHScroll(el)) return;
      const t = (el.innerText || "").trim().slice(0, 26).replace(/\n/g, "|");
      offenders.push(`+${Math.round(r.right - vw)}px <${el.tagName.toLowerCase()}> "${t}"`);
    });

    // 3) Şişkin sarmalayıcı
    const bloated: string[] = [];
    document.querySelectorAll<HTMLElement>("div").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 500) return;
      const kids = Array.from(el.children) as HTMLElement[];
      if (!kids.length) return;
      const bots = kids.map((k) => k.getBoundingClientRect().bottom);
      const tops = kids.map((k) => k.getBoundingClientRect().top);
      const contentH = Math.max(...bots) - Math.min(...tops);
      if (r.height - contentH > 300) bloated.push(`h=${Math.round(r.height)} içerik=${Math.round(contentH)} "${(el.innerText || "").trim().slice(0, 24).replace(/\n/g, "|")}"`);
    });

    // 4) Görünür alanda çakışan metinler (sticky header hariç)
    const vh = window.innerHeight;
    const leaves = Array.from(document.querySelectorAll<HTMLElement>("div,span,p"))
      .filter((e) => e.children.length === 0 && (e.innerText || "").trim().length > 2)
      .map((e) => ({ r: e.getBoundingClientRect(), t: (e.innerText || "").trim().slice(0, 18), sticky: (() => { let p: HTMLElement | null = e; while (p) { const s = getComputedStyle(p); if (s.position === "fixed" || s.position === "sticky") return true; p = p.parentElement; } return false; })() }))
      .filter((o) => o.r.height > 0 && o.r.top < vh && o.r.bottom > 0 && !o.sticky);
    const overlaps: string[] = [];
    for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i].r, b = leaves[j].r;
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 10 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 10)
        overlaps.push(`"${leaves[i].t}" X "${leaves[j].t}"`);
    }
    return { pageOverflowX, offenders: [...new Set(offenders)].slice(0, 6), bloated: bloated.slice(0, 4), overlaps: [...new Set(overlaps)].slice(0, 4) };
  }, VW);

  const bad = d.pageOverflowX > 1 || d.offenders.length || d.bloated.length || d.overlaps.length;
  console.log(`${bad ? "!!" : "ok"} [${label}] sayfaTaşma=${d.pageOverflowX}px taşan=${d.offenders.length} şişkin=${d.bloated.length} çakışma=${d.overlaps.length}`);
  d.offenders.forEach((o) => console.log("     TAŞAN: " + o));
  d.bloated.forEach((b) => console.log("     ŞİŞKİN: " + b));
  d.overlaps.forEach((o) => console.log("     ÇAKIŞMA: " + o));
  return bad;
}

test("MOBİL: ilan detay derin denetim (baştan sona kaydırarak, çok kategori)", async ({ page }) => {
  await page.setViewportSize({ width: VW, height: 844 });
  const envRaw = require("fs").readFileSync(require("path").join(__dirname, "..", ".env"), "utf8") as string;
  const pick = (k: string) => (envRaw.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  const res = await fetch(`${pick("EXPO_PUBLIC_SUPABASE_URL")}/rest/v1/listing_public_cards?select=id,category&status=eq.active&limit=60`, {
    headers: { apikey: pick("EXPO_PUBLIC_SUPABASE_ANON_KEY"), Authorization: `Bearer ${pick("EXPO_PUBLIC_SUPABASE_ANON_KEY")}` }
  });
  const rows: Array<{ id: string; category: string }> = await res.json();
  const seen = new Set<string>();
  const picked = rows.filter((r) => (seen.has(r.category) ? false : (seen.add(r.category), true))).slice(0, 6);

  let problems = 0;
  for (const r of picked) {
    await page.goto(`/listing/${r.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    // sayfayı adım adım kaydırarak denetle
    for (let s = 0; s < 5; s++) {
      const bad = await audit(page, `${r.category} @${s}`);
      if (bad) { problems++; await page.screenshot({ path: `e2e-artifacts/LD-${r.category.replace(/\W/g, "")}-${s}.png` }); }
      await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll<HTMLElement>("div"));
        const sc = divs.filter((e) => { const st = getComputedStyle(e); return (st.overflowY === "auto" || st.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 20; }).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
        if (sc) sc.scrollTop += 800; else window.scrollBy(0, 800);
      });
      await page.waitForTimeout(800);
    }
  }
  console.log(`\n=== TOPLAM SORUNLU EKRAN: ${problems} ===`);
});
