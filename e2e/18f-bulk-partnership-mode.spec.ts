import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql, E2E_LISTING_TAG } from "./helpers/supabase-admin";

/**
 * TOPLU İLAN — ortak satış modu sütunu (ortak_satis): satır bazında none/open/approval.
 * OrtakSat'ın çekirdeği ortak satış; her ilanı "approval"a zorlamak yerine satıcı seçer.
 * "none" = normal ilan (ortaksız, komisyonsuz → komisyon doğrulaması atlanır).
 */

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(4000);
}

test("Toplu ilan: ortak_satis sütunu → partnership_mode (açık/kapalı/onaylı) doğru yazılır", async ({ page }) => {
  const email = uniqueEmail("bulkpm");
  const sellerId = await createConfirmedUser(email, PW, "E2E Bulk PM");
  const base = Date.now().toString(36);
  const sOpen = `E2E-PM-OPEN-${base}`;
  const sNone = `E2E-PM-NONE-${base}`;
  const sAppr = `E2E-PM-APPR-${base}`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, email);
  await page.goto("/toplu-ilan", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  // 3 satır: açık / kapalı(komisyon boş → none'da hata YOK) / onaylı(boş → varsayılan).
  const csv = `harici_kod,baslik,aciklama,fiyat,kategori,il,ilce,komisyon,stok,gorsel_url,ortak_satis
${sOpen},E2E PM Acik ${E2E_LISTING_TAG},Ortaklik modu testi acik satir aciklamasi yeterince uzun,1500,Elektronik,İstanbul,Kadıköy,15,2,,açık
${sNone},E2E PM Kapali ${E2E_LISTING_TAG},Ortaklik modu testi kapali normal ilan aciklamasi uzun,900,Elektronik,İstanbul,Kadıköy,,1,,kapalı
${sAppr},E2E PM Onayli ${E2E_LISTING_TAG},Ortaklik modu testi onayli varsayilan aciklama metni uzun,2200,Elektronik,İstanbul,Kadıköy,20,3,,`;
  const ta = page.getByPlaceholder(/CSV içeriğini/i).first();
  await ta.click();
  await ta.fill(csv);
  await page.getByText("Ayrıştır ve önizle", { exact: true }).click();
  await page.waitForTimeout(1500);

  const body = await page.locator("body").innerText();
  // 3/3 geçerli olmalı (komisyonsuz "kapalı" satır hata VERMEMELİ).
  expect(body, "3/3 geçerli olmalı (none satırı komisyonsuz geçer)").toContain("3/3");
  expect(body, "önizlemede 'ortaklık herkese açık' göstergesi").toContain("ortaklık herkese açık");
  expect(body, "önizlemede 'ortak satış kapalı' göstergesi").toContain("ortak satış kapalı");
  await page.screenshot({ path: "e2e-artifacts/bulk-partnership-mode.png", fullPage: true });

  await page.getByText(/ilanı onaya gönder/i).first().click();
  await page.waitForTimeout(7000);

  // DB: her SKU doğru partnership_mode ile yazılmalı.
  const rows = await runSql<Array<{ external_id: string; partnership_mode: string }>>(
    `select external_id, partnership_mode from listings where owner_id='${sellerId}' and external_id in ('${sOpen}','${sNone}','${sAppr}');`
  );
  const byId = new Map(rows.map((r) => [r.external_id, r.partnership_mode]));
  expect(byId.get(sOpen), "açık → open").toBe("open");
  expect(byId.get(sNone), "kapalı → none").toBe("none");
  expect(byId.get(sAppr), "boş → approval (varsayılan)").toBe("approval");
});
