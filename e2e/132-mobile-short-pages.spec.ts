import { test, expect } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

/**
 * KISA SAYFALARDA ŞİŞME (2026-11-16). Telefon genişliğinde içerik az olan sayfalarda filtre düğmeleri ve
 * giriş/seçim kutuları boş alanı yutup ekranı dikeyde kaplıyordu (uygulamada görüldü; aynı bileşenler web'de de var).
 * Ölçüt: hiçbir düğme/sekme 120 px'ten, hiçbir giriş/seçim kutusu 140 px'ten uzun olmamalı.
 */
const PW = "GucluSifre123!";
const PAGES = ["/sikayetlerim", "/alici-talepleri", "/engellenenler", "/araclar?mode=analysis", "/araclar?mode=performance", "/destek"];

test("telefon genişliğinde kısa sayfalarda düğme ve kutular şişmez", async ({ browser }) => {
  test.setTimeout(240_000);
  const email = uniqueEmail("shortpages");
  await createConfirmedUser(email, PW, "E2E Kisa Sayfa");
  await resetAuthRateLimits();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "tr-TR", isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("ortaksat.cookieConsent.v1", JSON.stringify({ v: 1, analytics: false, marketing: false, at: "t" })); } catch {} });
  const page = await ctx.newPage();
  await page.goto("/giris", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const emailEntry = page.getByRole("button", { name: "E-posta ile devam et" });
  if (await emailEntry.count()) await emailEntry.first().click();
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByRole("button", { name: "E-posta ile giriş yap" }).last().click();
  await page.waitForTimeout(5500);

  const problems: string[] = [];
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4500);
    const tall = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll('[role="button"],[role="tab"],button,input,textarea'))) {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width === 0) continue;
        const limit = el.tagName === "TEXTAREA" ? 400 : el.tagName === "INPUT" ? 140 : 120;
        if (r.height > limit) out.push(`${el.tagName} "${((el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || "").slice(0, 30)}" ${Math.round(r.height)}px`);
      }
      return out;
    });
    // Alıcı Bulma Merkezi: arama kutusu ile "N talep" satırı arasında dev boşluk kalmamalı (kutunun şişmesi).
    if (path === "/alici-talepleri") {
      const gap = await page.evaluate(() => {
        const inp = document.querySelector('input[placeholder*="taleplerinde"]');
        const count = Array.from(document.querySelectorAll("div")).find((d) => /^\d+ talep$/.test((d.textContent || "").trim()) && d.children.length === 0);
        if (!inp || !count) return -1;
        return Math.round(count.getBoundingClientRect().top - inp.getBoundingClientRect().bottom);
      });
      if (gap < 0 || gap > 80) problems.push(`${path}: arama kutusu ile sayaç arası ${gap}px`);
    }
    await page.screenshot({ path: `e2e-artifacts/short-pages/${path.replace(/[^a-z]+/gi, "-")}.png` });
    for (const t of tall) problems.push(`${path}: ${t}`);
  }
  expect(problems, "şişmiş düğme / kutu").toEqual([]);
  await ctx.close();
});
