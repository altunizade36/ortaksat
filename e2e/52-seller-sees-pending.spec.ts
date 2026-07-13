import { test, devices, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);
}

/**
 * Satıcı, KENDİ aktif-olmayan ilanlarını (pending_review / paused) panelinde görüyor mu?
 * (Moderasyon kapalıyken normalde pending oluşmaz; ama yasaklı-kelime taraması "review"
 *  verirse oluşur. O durumda ilan satıcıya görünmezse "sessizce kayboldu" hissi doğar.)
 */
test("Satıcı kendi pending_review / paused ilanını panelde GÖRÜYOR mu?", async ({ page }) => {
  test.setTimeout(300_000);
  const email = uniqueEmail("pendsee");
  const userId = await createConfirmedUser(email, PW, "E2E Pending");

  // Doğrudan DB'ye: biri incelemede, biri duraklatılmış iki ilan
  await runSql(`insert into listings (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo)
    values (gen_random_uuid(), '${userId}', 'E2E INCELEMEDE ILAN', 'e2e-incelemede-' || substr(md5(random()::text),1,8), 'İstanbul', 'test', 'Otomobil', 100000, 'rate', 10, 'pending_review', 1, false),
           (gen_random_uuid(), '${userId}', 'E2E DURAKLATILMIS ILAN', 'e2e-duraklatilmis-' || substr(md5(random()::text),1,8), 'İstanbul', 'test', 'Otomobil', 200000, 'rate', 10, 'paused', 1, false)`);

  await login(page, email);
  await page.goto("/seller", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: "e2e-artifacts/seller-pending.png", fullPage: false });

  const body = await page.locator("body").innerText();
  const gorPending = /E2E INCELEMEDE ILAN/i.test(body);
  const gorPaused = /E2E DURAKLATILMIS ILAN/i.test(body);
  console.log(`\nincelemedeki ilan panelde görünüyor mu? ${gorPending ? "EVET ✓" : "HAYIR ✗"}`);
  console.log(`duraklatılmış ilan panelde görünüyor mu?  ${gorPaused ? "EVET ✓" : "HAYIR ✗"}`);

  // aşağı kaydırıp tekrar bak (ilan listesi altta olabilir)
  if (!gorPending || !gorPaused) {
    await page.evaluate(() => {
      const d = Array.from(document.querySelectorAll<HTMLElement>("div"));
      const sc = d.filter((e) => { const s = getComputedStyle(e); return (s.overflowY === "auto" || s.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 20; }).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (sc) sc.scrollTop = sc.scrollHeight; else window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2500);
    const body2 = await page.locator("body").innerText();
    console.log(`  (kaydırdıktan sonra) incelemede=${/E2E INCELEMEDE ILAN/i.test(body2)} duraklatılmış=${/E2E DURAKLATILMIS ILAN/i.test(body2)}`);
    await page.screenshot({ path: "e2e-artifacts/seller-pending-bottom.png" });
  }

  expect(gorPending, "satıcı incelemedeki KENDİ ilanını görmeli").toBe(true);
  expect(gorPaused, "satıcı duraklatılmış KENDİ ilanını görmeli").toBe(true);
});
