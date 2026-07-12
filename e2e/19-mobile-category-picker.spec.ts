import { test, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().click();
  await page.waitForTimeout(5000);
}

/** İç scroll konteynerinin ölçüsü + görünür alanın ne kadarı boş. */
async function probe(page: Page, label: string) {
  const d = await page.evaluate(() => {
    const vh = window.innerHeight, vw = window.innerWidth;
    // görünür viewport içinde metin taşıyan en alt öğe
    let lastBottom = 0;
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > 0 && (el.innerText || "").trim() && r.top < vh && r.bottom > 0) {
        lastBottom = Math.max(lastBottom, Math.min(r.bottom, vh));
      }
    });
    // üst üste binen metin kutuları (aynı seviyede çakışma)
    const texts = Array.from(document.querySelectorAll<HTMLElement>("div,span,p"))
      .filter((e) => e.children.length === 0 && (e.innerText || "").trim().length > 2)
      .map((e) => ({ r: e.getBoundingClientRect(), t: (e.innerText || "").trim().slice(0, 22) }))
      .filter((o) => o.r.height > 0 && o.r.top < vh && o.r.bottom > 0);
    const overlaps: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].r, b = texts[j].r;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 8 && oy > 8) overlaps.push(`"${texts[i].t}" X "${texts[j].t}"`);
      }
    }
    return { vw, vh, lastBottom: Math.round(lastBottom), blankBottom: Math.round(vh - lastBottom), overlaps: overlaps.slice(0, 6) };
  });
  console.log(`[${label}] görünür alt boşluk=${d.blankBottom}px (vh=${d.vh}) | çakışma=${d.overlaps.length}`);
  d.overlaps.forEach((o) => console.log("    ÇAKIŞMA: " + o));
  return d;
}

for (const VW of [390, 360]) {
  test(`MOBİL ${VW}px: kategori ağacında gezinme (bomboş beyaz / çakışma?)`, async ({ page }) => {
    await page.setViewportSize({ width: VW, height: 844 });
    const email = uniqueEmail(`mcat${VW}`);
    await createConfirmedUser(email, PW, "E2E Cat");
    await login(page, email);

    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `e2e-artifacts/c${VW}-0-root.png` });
    await probe(page, `${VW} kök`);

    // Üst kategoriye tıkla → alt seviye
    for (const [i, name] of [/Emlak/, /Vasıta/, /Elektronik/].entries()) {
      const el = page.getByText(name).first();
      if (!(await el.count())) continue;
      await el.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `e2e-artifacts/c${VW}-${i + 1}-level.png` });
      await probe(page, `${VW} seviye-${i + 1} (${name})`);
      // geri dön
      await page.getByText(/Geri|Tümü|Kategori/).first().click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1200);
    }
  });
}
