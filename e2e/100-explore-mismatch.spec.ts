import { test, expect, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/explore-mismatch";

// Kartın gerçek başlığını çıkar: özel-alan ikon glyph'lerini ve rozet metnini at.
function cleanTitle(raw: string): string {
  return raw
    .replace(/[--￿]/g, " ") // ikon glyph'leri (private use)
    .replace(/Vitrin ürünü|Görsel|Ortaklığa açık|Anında ortak|ÖRNEK|Kazanç[^\n]*/gi, " ")
    .replace(/₺[\d.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kartları tara, her birini KOORDİNATLA tıkla, açılan ilan başlığı kartla eşleşiyor mu. */
async function scan(page: Page, tag: string, scrollY: number) {
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  if (scrollY > 0) { await page.mouse.wheel(0, scrollY); await page.waitForTimeout(1500); }

  const cards = await page.evaluate(() => {
    const out: Array<{ title: string; cx: number; cy: number }> = [];
    const nodes = Array.from(document.querySelectorAll('[role="link"]'));
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      if (r.width < 120 || r.height < 140) continue;
      const cy = r.y + r.height / 2;
      if (cy < 80 || cy > window.innerHeight - 40) continue; // MERKEZİ görünür (koordinat tıklaması isabet etsin)
      out.push({ title: (n as HTMLElement).innerText, cx: r.x + r.width / 2, cy });
    }
    return out;
  });
  console.log(`[${tag}] tam görünür kart: ${cards.length} (scrollY=${scrollY})`);
  if (!cards.length) return { checked: 0, mismatches: [] as string[] };

  const mismatches: string[] = [];
  let checked = 0;
  // İlk 3 görünür kartı test et
  for (const card of cards.slice(0, 3)) {
    const cardTitle = cleanTitle(card.title).split(" ").slice(0, 3).join(" ");
    if (!cardTitle || cardTitle.length < 3) continue;
    await page.mouse.click(card.cx, card.cy);
    await page.waitForTimeout(3000);
    const opened = await page.evaluate(() => ({
      url: location.pathname,
      h1: (document.querySelector("h1")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
    }));
    const key = cardTitle.split(" ")[0];
    const match = opened.h1.includes(key) || opened.h1.includes(cardTitle);
    checked++;
    console.log(`[${tag}] kart "${cardTitle}" → açılan h1:"${opened.h1}" | eşleşme:${match} | taşma:${opened.overflow}px`);
    if (!match) mismatches.push(`"${cardTitle}" → "${opened.h1}"`);
    if (opened.overflow > 2) mismatches.push(`TAŞMA ${opened.overflow}px (${opened.h1})`);
    await page.goBack().catch(() => {});
    await page.waitForTimeout(2500);
    if (scrollY > 0) { await page.mouse.wheel(0, scrollY); await page.waitForTimeout(1200); }
  }
  return { checked, mismatches };
}

test("KEŞFET eşleşme (mobil, kaydırmadan)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const r = await scan(await ctx.newPage(), "mobil-üst", 0);
  console.log(`[mobil-üst] SONUÇ: ${r.checked} kontrol, ${r.mismatches.length} mismatch: ${r.mismatches.join(" ; ")}`);
  expect(r.mismatches, `mobil üst kartlar eşleşmeli: ${r.mismatches.join(" ; ")}`).toHaveLength(0);
  await ctx.close();
});

test("KEŞFET eşleşme (mobil, kaydırdıktan sonra)", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const r = await scan(await ctx.newPage(), "mobil-kaydir", 1400);
  console.log(`[mobil-kaydir] SONUÇ: ${r.checked} kontrol, ${r.mismatches.length} mismatch: ${r.mismatches.join(" ; ")}`);
  expect(r.mismatches, `mobil kaydırma sonrası kartlar eşleşmeli: ${r.mismatches.join(" ; ")}`).toHaveLength(0);
  await ctx.close();
});
