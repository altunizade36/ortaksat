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

/** Aramada önerilere sırayla tıkla; forma girene kadar dene. */
async function searchToForm(page: Page, term: string): Promise<boolean> {
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill(term);
  await page.waitForTimeout(1400);
  for (let i = 0; i < 5; i++) {
    const sug = page.locator("text=/›/").nth(i);
    if (!(await sug.count())) break;
    if (!(await sug.click({ timeout: 4000 }).then(() => true).catch(() => false))) continue;
    await page.waitForTimeout(2400);
    if (await page.evaluate(() => /İlan başlığı/i.test(document.body.innerText))) return true;
    // forma girmediyse tekrar ara
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    await page.getByPlaceholder(/ne satıyorsun/i).first().fill(term);
    await page.waitForTimeout(1300);
  }
  return page.evaluate(() => /İlan başlığı/i.test(document.body.innerText));
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
    return { h: sc.scrollHeight, bloated, hasMulti: /Donanım & Özellikler/i.test(document.body.innerText), pageOverflow: document.documentElement.scrollWidth - 390 };
  });
  if ("err" in d) { console.log(`?? [${label}]`); return; }
  const flag = d.bloated.length > 0 || d.pageOverflow > 1;
  console.log(`${flag ? "!!" : "ok"} ${label.padEnd(18)} donanım=${d.hasMulti ? "VAR" : "yok"} h=${String(d.h).padStart(5)} taşma=${d.pageOverflow} şişkin=${d.bloated.length}`);
  d.bloated.forEach((b) => console.log("     ŞİŞKİN: " + b));
}

const TERMS = ["satılık daire", "ofis", "buzdolabı", "koltuk", "laptop", "iphone", "bisiklet", "traktör", "ayakkabı", "kamera"];

test("YAPRAK ARAMA: gerçekten forma inip donanım bölümü + şişme denetimi", async ({ page }) => {
  await page.setViewportSize({ width: VW, height: 844 });
  const email = uniqueEmail("leafs");
  await createConfirmedUser(email, PW, "E2E Leaf");
  await login(page, email);

  for (const t of TERMS) {
    const ok = await searchToForm(page, t);
    if (!ok) { console.log(`?? ${t}: forma ulaşılamadı`); continue; }
    await measure(page, t);
  }
});
