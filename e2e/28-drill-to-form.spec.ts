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

const inForm = (page: Page) => page.evaluate(() => /İlan başlığı/i.test(document.body.innerText));

/** Kategori ağacında forma ulaşana kadar ilk alt kategoriye tıklamayı sürdür. */
async function drillToForm(page: Page, top: string): Promise<boolean> {
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2800);
  const t = page.getByText(top, { exact: true }).first();
  if (!(await t.click({ timeout: 6000 }).then(() => true).catch(() => false))) return false;
  await page.waitForTimeout(1600);

  for (let depth = 0; depth < 6; depth++) {
    if (await inForm(page)) return true;
    // alt kategori satırları: "— ALT KATEGORİ" listesindeki tıklanabilir satırlar
    const rows = page.locator('[role="button"]').filter({ hasNotText: /Geri|Değiştir|Ara$|Ana Sayfa/ });
    const n = await rows.count();
    let clicked = false;
    for (let i = 0; i < Math.min(n, 40); i++) {
      const r = rows.nth(i);
      const txt = ((await r.innerText().catch(() => "")) || "").trim();
      if (!txt || txt.length > 40) continue;
      if (/Kategori|İlan Bilgileri|Konum|Fotoğraf|Komisyon|Önizleme|Geri|Ara/.test(txt)) continue;
      if (await r.click({ timeout: 4000 }).then(() => true).catch(() => false)) { clicked = true; break; }
    }
    if (!clicked) return await inForm(page);
    await page.waitForTimeout(1800);
  }
  return await inForm(page);
}

async function measure(page: Page, label: string) {
  const d = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll<HTMLElement>("div"));
    const sc = divs.filter((e) => { const s = getComputedStyle(e); return (s.overflowY === "auto" || s.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 20; }).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!sc) return { err: true as const };
    const bloated: string[] = [];
    sc.querySelectorAll<HTMLElement>("div").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 500) return;
      const kids = Array.from(el.children) as HTMLElement[];
      if (!kids.length) return;
      const bots = kids.map((k) => k.getBoundingClientRect().bottom);
      const tops = kids.map((k) => k.getBoundingClientRect().top);
      const ch = Math.max(...bots) - Math.min(...tops);
      if (r.height - ch > 300) bloated.push(`h=${Math.round(r.height)} içerik=${Math.round(ch)} "${(el.innerText || "").trim().slice(0, 24).replace(/\n/g, "|")}"`);
    });
    let overflowX = 0;
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && r.right > 391) overflowX = Math.max(overflowX, Math.round(r.right - 390));
    });
    return { h: sc.scrollHeight, bloated, hasMulti: /Donanım & Özellikler/i.test(document.body.innerText), pageOverflow: document.documentElement.scrollWidth - 390, overflowX };
  });
  if ("err" in d) { console.log(`?? [${label}]`); return; }
  const flag = d.bloated.length > 0 || d.pageOverflow > 1;
  console.log(`${flag ? "!!" : "ok"} ${label.padEnd(26)} donanım=${d.hasMulti ? "VAR" : "yok"} h=${String(d.h).padStart(5)} sayfaTaşma=${d.pageOverflow} şişkin=${d.bloated.length}`);
  d.bloated.forEach((b) => console.log("     ŞİŞKİN: " + b));
}

const TOPS = ["Emlak", "Vasıta", "İkinci El & Sıfır Alışveriş", "Yedek Parça, Aksesuar, Donanım & Tuning", "Hizmetler", "İş İlanları", "Özel Ders Verenler", "Hayvanlar Alemi"];

test("HER ÜST KATEGORİ: forma inip yerleşim denetimi", async ({ page }) => {
  await page.setViewportSize({ width: VW, height: 844 });
  const email = uniqueEmail("drill");
  await createConfirmedUser(email, PW, "E2E Drill");
  await login(page, email);

  for (const top of TOPS) {
    const reached = await drillToForm(page, top);
    if (!reached) { console.log(`?? ${top}: forma ULAŞILAMADI`); continue; }
    await measure(page, top);
  }
});
