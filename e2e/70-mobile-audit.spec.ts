import { test, devices, expect } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

/**
 * MOBİL BOZUKLUK TARAMASI (canlıya karşı).
 * Her sayfada: (1) YATAY TAŞMA (sayfa sağa kayıyor mu), (2) viewport'tan geniş
 * elemanlar, (3) JS konsol hataları. "Mobilde bozukluk var" şikayetini
 * TAHMİNLE değil ÖLÇÜMLE bulur.
 */
const PAGES = [
  ["Ana sayfa", "/"],
  ["Keşfet", "/explore"],
  ["Kategoriler", "/kategoriler"],
  ["Kategori (Emlak)", "/kategori/emlak"],
  ["İlan ver", "/create"],
  ["Giriş", "/auth"],
  ["Nasıl çalışır", "/nasil-calisir"],
  ["Blog", "/blog"],
  ["Yasal", "/legal"],
  ["Ortak kazanç", "/ortak-kazanc"],
  ["Satıcı ol", "/satici-ol"],
  ["Güvenli alışveriş", "/guvenli-alisveris"],
  ["İletişim", "/iletisim"]
];

test("MOBİL TARAMA: yatay taşma + geniş eleman + konsol hatası", async ({ page }) => {
  test.setTimeout(600_000);
  const problems: string[] = [];

  for (const [name, path] of PAGES) {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));

    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500); // mount + hydration

    const res = await page.evaluate(() => {
      const vw = window.innerWidth;
      const doc = document.documentElement;
      const overflow = Math.max(doc.scrollWidth, document.body.scrollWidth) - vw;
      // Viewport'tan taşan görünür elemanlar (ilk 5)
      const wide: string[] = [];
      document.querySelectorAll<HTMLElement>("*").forEach((el) => {
        if (wide.length >= 5) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > vw + 2 || r.left < -2) {
          const cls = (el.className || "").toString().slice(0, 30);
          const txt = (el.textContent || "").trim().slice(0, 28);
          wide.push(`${el.tagName}.${cls} w=${Math.round(r.width)} right=${Math.round(r.right)} "${txt}"`);
        }
      });
      return { vw, overflow, wide };
    });

    const bad = res.overflow > 2;
    console.log(`\n${bad ? "!! TAŞMA" : "OK     "} ${name} (${path}) — taşma=${res.overflow}px${errors.length ? ` · JS hata=${errors.length}` : ""}`);
    if (bad) {
      problems.push(`${name}: ${res.overflow}px taşma`);
      res.wide.forEach((w) => console.log(`      taşan: ${w}`));
    }
    if (errors.length) {
      problems.push(`${name}: ${errors.length} JS hatası`);
      errors.slice(0, 2).forEach((e) => console.log(`      JS: ${e}`));
    }
    page.removeAllListeners("pageerror");
  }

  console.log(`\n=== ÖZET: ${problems.length === 0 ? "SORUN YOK" : `${problems.length} SORUN`} ===`);
  problems.forEach((p) => console.log(`  • ${p}`));
  expect(problems, `Mobil sorunlar:\n${problems.join("\n")}`).toEqual([]);
});
