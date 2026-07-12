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
      if (r.height - ch > 300) bloated.push(`h=${Math.round(r.height)} içerik=${Math.round(ch)} "${(el.innerText || "").trim().slice(0, 26).replace(/\n/g, "|")}"`);
    });
    const body = document.body.innerText;
    const hasMulti = /Donanım & Özellikler/i.test(body);
    return { h: sc.scrollHeight, bloated, hasMulti };
  });
  if ("err" in d) { console.log(`?? [${label}] scroll konteyner yok`); return; }
  const flag = d.bloated.length > 0;
  console.log(`${flag ? "!!" : "ok"} [${label}] h=${d.h} multiselectBölümü=${d.hasMulti ? "VAR" : "yok"} şişkin=${d.bloated.length}`);
  d.bloated.forEach((b) => console.log("     ŞİŞKİN: " + b));
}

// Ağaçtan derin yaprağa git: [üst, ...ara, yaprak]
const PATHS: string[][] = [
  ["Emlak", "Konut", "Satılık"],
  ["Emlak", "İş Yeri", "Satılık"],
  ["Vasıta", "Otomobil"],
  ["Vasıta", "Motosiklet"],
  ["Vasıta", "Ticari Araçlar"],
  ["İkinci El & Sıfır Alışveriş", "Bilgisayar"],
  ["İkinci El & Sıfır Alışveriş", "Ev & Bahçe"]
];

test("DERİN YAPRAK FORMLARI: multiselect bölümü olanlarda şişme var mı?", async ({ page }) => {
  await page.setViewportSize({ width: VW, height: 844 });
  const email = uniqueEmail("deepleaf");
  await createConfirmedUser(email, PW, "E2E DeepLeaf");
  await login(page, email);

  for (const path of PATHS) {
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2800);
    let ok = true;
    for (const seg of path) {
      const el = page.getByText(seg, { exact: true }).first();
      const clicked = await el.click({ timeout: 6000 }).then(() => true).catch(() => false);
      if (!clicked) { console.log(`?? ${path.join(" › ")}: "${seg}" tıklanamadı`); ok = false; break; }
      await page.waitForTimeout(1800);
    }
    if (!ok) continue;
    await page.waitForTimeout(1500);
    await measure(page, path.join(" › "));
  }
});
