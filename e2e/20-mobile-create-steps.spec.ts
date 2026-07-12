import { test, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const VW = 390;

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().click();
  await page.waitForTimeout(5000);
}

async function probe(page: Page, label: string) {
  const d = await page.evaluate(() => {
    const vh = window.innerHeight, vw = window.innerWidth;
    const leaves = Array.from(document.querySelectorAll<HTMLElement>("div,span,p,input,textarea"))
      .filter((e) => e.children.length === 0)
      .map((e) => ({ r: e.getBoundingClientRect(), t: (e.innerText || (e as HTMLInputElement).placeholder || "").trim().slice(0, 24) }))
      .filter((o) => o.r.height > 0 && o.r.width > 0);

    // yatay taşma (viewport dışına çıkan öğeler)
    const overflowing = leaves.filter((o) => o.r.right > vw + 1 || o.r.left < -1).map((o) => `"${o.t}" right=${Math.round(o.r.right)}`);

    // çakışan metinler (görünür alanda)
    const vis = leaves.filter((o) => o.t && o.r.top < vh && o.r.bottom > 0);
    const overlaps: string[] = [];
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i].r, b = vis[j].r;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 10 && oy > 10) overlaps.push(`"${vis[i].t}" X "${vis[j].t}"`);
    }
    // içeriğin bittiği nokta (iç scroll konteynerinde)
    let lastBottom = 0;
    vis.forEach((o) => { lastBottom = Math.max(lastBottom, Math.min(o.r.bottom, vh)); });
    return {
      overflowing: overflowing.slice(0, 8),
      overlaps: overlaps.slice(0, 8),
      blankBottom: Math.round(vh - lastBottom)
    };
  });
  const bad = d.overflowing.length || d.overlaps.length || d.blankBottom > 250;
  console.log(`${bad ? "!!" : "ok"} [${label}] taşan=${d.overflowing.length} çakışma=${d.overlaps.length} altBoşluk=${d.blankBottom}px`);
  d.overflowing.forEach((o) => console.log("     TAŞAN: " + o));
  d.overlaps.forEach((o) => console.log("     ÇAKIŞMA: " + o));
  return d;
}

test("MOBİL: ilan verme 6 adımının tamamı", async ({ page }) => {
  await page.setViewportSize({ width: VW, height: 844 });
  const email = uniqueEmail("msteps");
  await createConfirmedUser(email, PW, "E2E Steps");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  // kategori seç (arama ile)
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1500);
  await page.getByText(/Otomobil/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Her adım çipine tıkla ve incele
  const steps: Array<[string, RegExp]> = [
    ["2-IlanBilgileri", /İlan Bilgileri/],
    ["3-Konum", /Konum/],
    ["4-Fotograflar", /Fotoğraflar/],
    ["5-Komisyon", /Komisyon & Ortak Satış/],
    ["6-Onizleme", /Önizleme & Yayınla/]
  ];
  for (const [name, rx] of steps) {
    const chip = page.getByText(rx).first();
    await chip.click({ timeout: 8000 }).catch((e) => console.log(`${name} çipi tıklanamadı: ${e.message.slice(0, 60)}`));
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `e2e-artifacts/step-${name}.png` });
    await probe(page, name);
    // adımın altını da gör
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("div"));
      const sc = els.find((e) => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== "visible");
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `e2e-artifacts/step-${name}-bottom.png` });
    await probe(page, `${name} (alt)`);
  }
});
