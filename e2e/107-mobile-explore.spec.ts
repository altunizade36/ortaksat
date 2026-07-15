import { test, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/mobile-explore";

async function audit(page: Page, tag: string) {
  const jsErr: string[] = [];
  page.on("pageerror", (e) => jsErr.push(String(e).slice(0, 120)));
  page.on("console", (m) => { if (m.type() === "error") jsErr.push(m.text().slice(0, 120)); });

  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}/${tag}-1.png`, fullPage: false }).catch(() => {});

  const probe = await page.evaluate(() => {
    const de = document.documentElement;
    const overflow = Math.max(0, de.scrollWidth - de.clientWidth);
    // Taşan öğe var mı (viewport'tan geniş)
    const vw = window.innerWidth;
    const wide: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*")).slice(0, 4000)) {
      const r = el.getBoundingClientRect();
      if (r.width > vw + 2 && r.height > 8) {
        const t = (el as HTMLElement).innerText?.slice(0, 24).replace(/\s+/g, " ") ?? "";
        wide.push(`${el.tagName}.${(el.className || "").toString().slice(0, 14)} w=${Math.round(r.width)} "${t}"`);
      }
    }
    // Kart görselleri
    const imgs = Array.from(document.querySelectorAll('img[src*="/demo/"]')).map((im) => {
      const r = im.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }).slice(0, 4);
    // Filtre çipleri satırı taşıyor mu (yatay)
    return { overflow, wide: [...new Set(wide)].slice(0, 6), imgs, vw };
  });
  console.log(`\n[${tag} ${probe.vw}px] taşma:${probe.overflow}px | JS:${jsErr.length ? jsErr.join(" ; ") : "yok"}`);
  console.log(`  taşan öğeler: ${probe.wide.length ? probe.wide.join(" | ") : "yok"}`);
  console.log(`  kart görsel: ${JSON.stringify(probe.imgs)}`);

  // Kategori filtresini aç — taşma/bozulma oluyor mu
  const catToggle = page.getByText(/Kategoriye göre filtrele|Kategori/i).first();
  if (await catToggle.count().then((c) => c > 0).catch(() => false)) {
    await catToggle.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const afterCat = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    await page.screenshot({ path: `${OUT}/${tag}-2-kategori.png`, fullPage: false }).catch(() => {});
    console.log(`  kategori açılınca taşma: ${afterCat}px`);
  }
  return jsErr;
}

test("MOBİL KEŞFET (iPhone SE - küçük)", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ ...devices["iPhone SE"] });
  await audit(await ctx.newPage(), "se");
  await ctx.close();
});

test("MOBİL KEŞFET (iPhone 13)", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  await audit(await ctx.newPage(), "ip13");
  await ctx.close();
});

test("MOBİL KEŞFET (Pixel 7 - Android)", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  await audit(await ctx.newPage(), "pixel");
  await ctx.close();
});

test("MOBİL KEŞFET (Galaxy S9+ - geniş)", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ ...devices["Galaxy S9+"] });
  await audit(await ctx.newPage(), "galaxy");
  await ctx.close();
});
