import { test, devices } from "@playwright/test";
test.use({ ...devices["iPhone 13"] });
test("ilan detay estetik", async ({ page }) => {
  const env = require("fs").readFileSync(require("path").join(__dirname, "..", ".env"), "utf8") as string;
  const pick = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  const res = await fetch(`${pick("EXPO_PUBLIC_SUPABASE_URL")}/rest/v1/listing_public_cards?select=id&status=eq.active&limit=1`, {
    headers: { apikey: pick("EXPO_PUBLIC_SUPABASE_ANON_KEY"), Authorization: `Bearer ${pick("EXPO_PUBLIC_SUPABASE_ANON_KEY")}` }
  });
  const [row] = await res.json();
  await page.goto(`/listing/${row.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  for (const [i, y] of [0, 800, 1600, 2400].entries()) {
    await page.evaluate((yy) => {
      const d = Array.from(document.querySelectorAll<HTMLElement>("div"));
      const sc = d.filter(e => { const s = getComputedStyle(e); return (s.overflowY==="auto"||s.overflowY==="scroll") && e.scrollHeight>e.clientHeight+20; }).sort((a,b)=>b.scrollHeight-a.scrollHeight)[0];
      if (sc) sc.scrollTop = yy; else window.scrollTo(0, yy);
    }, y);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `e2e-artifacts/det-${i}.png` });
  }
  // ölçüm: taşan öğe + küçük dokunma hedefi
  const d = await page.evaluate(() => {
    const vw = window.innerWidth;
    const inH = (el: HTMLElement) => { let p = el.parentElement; while (p && p !== document.body) { const s = getComputedStyle(p); if (s.overflowX==="auto"||s.overflowX==="scroll") return true; p = p.parentElement; } return false; };
    const over: string[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width===0||r.height===0||r.right<=vw+1||inH(el)) return;
      const t=(el.innerText||"").trim().slice(0,22).replace(/\n/g,"|"); if(t) over.push(`+${Math.round(r.right-vw)}px "${t}"`);
    });
    return { pageOverflow: document.documentElement.scrollWidth - vw, over: [...new Set(over)].slice(0,5) };
  });
  console.log("DETAY:", JSON.stringify(d));
});
