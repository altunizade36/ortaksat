import { test, expect, type Page } from "@playwright/test";
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

/**
 * KRİTİK KONTROL: select açıldıktan sonra SEÇENEKLERİ görünür alanda mı?
 * (Eski hata: liste ekranın altında kalıyor, kullanıcı hiçbir şey görmüyordu.)
 * Açık listenin kutusunu bul; görünür alanla kesişimini ölç.
 */
async function openedListVisibility(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    // AÇIK LİSTEYİ BİREBİR hedefle (DSelect ona data-openlist="1" basar).
    const el = document.querySelector('[data-openlist="1"]') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return { h: Math.round(r.height), visible: Math.round(visible), top: Math.round(r.top) };
  });
}

test("İLAN VER mobil: açılan her seçim listesi GÖRÜNÜR alanda mı?", async ({ page }) => {
  await page.setViewportSize({ width: VW, height: 844 });
  const email = uniqueEmail("selvis");
  await createConfirmedUser(email, PW, "E2E SelVis");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2800);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1400);
  await page.locator("text=/›/").first().click();
  await page.waitForTimeout(2800);

  const count = await page.getByText("Seçin", { exact: true }).count();
  console.log(`\n${count} seçim kutusu\n`);
  let hidden = 0;

  for (let i = 0; i < count; i++) {
    const box = page.getByText("Seçin", { exact: true }).nth(i);
    if (!(await box.count())) break;
    await box.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(250);
    if (!(await box.click({ timeout: 5000 }).then(() => true).catch(() => false))) continue;
    await page.waitForTimeout(1100); // scrollIntoView (smooth) tamamlansın

    const v = await openedListVisibility(page);
    if (!v) { console.log(`?? [${i}] liste bulunamadı`); }
    else {
      const ratio = v.h ? v.visible / v.h : 0;
      const ok = ratio > 0.5; // listenin yarısından fazlası görünmeli
      if (!ok) { hidden++; await page.screenshot({ path: `e2e-artifacts/hid-${i}.png` }); }
      console.log(`${ok ? "ok" : "!!"} [${i}] liste h=${v.h} görünen=${v.visible} (%${Math.round(ratio * 100)})`);
    }
    await box.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  console.log(`\n=== GÖRÜNMEYEN LİSTE: ${hidden}/${count} ===`);
  expect(hidden, "açılan hiçbir seçim listesi ekran dışında kalmamalı").toBe(0);
});
