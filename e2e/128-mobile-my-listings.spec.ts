import { test, expect } from "@playwright/test";
import { acceptConfirm } from "./helpers/confirm";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

/**
 * UYGULAMA ARAYÜZÜ — İlanlarım (components/mobile/my-listings.tsx): yayın yeri satırı, yayındaki ilanı
 * "Satıldı" işaretleme ve yayındaki ilanı doğrudan silme.
 *
 * Yalnız MOBİL ÖNİZLEME sunucusuna karşı çalışır (uygulama arayüzü tarayıcıda):
 *   EXPO_PUBLIC_MOBILE_PREVIEW=1 expo start --port 8090 --localhost     (CI=1 VERME)
 *   E2E_BASE_URL=http://localhost:8090 playwright test e2e/128-mobile-my-listings.spec.ts
 * Canlı siteye karşı (varsayılan) çalıştırılırsa atlanır: orada /seller web panelidir.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("Uygulama İlanlarım: yayın yeri + Satıldı + yayındaki ilanı sil", async ({ page, baseURL }) => {
  test.skip(!/localhost:8090/.test(baseURL || ""), "yalnız mobil önizleme sunucusunda çalışır");
  test.setTimeout(300_000);
  const email = uniqueEmail("ilanlarim");
  const uid = await createConfirmedUser(email, PW, "E2E Ilanlarim");
  const insert = (title: string, slug: string) => runSql<Array<{ id: string }>>(`
    insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency, attributes)
    values ('${uid}', '${title}', '${slug}-${Date.now()}', 'E2E İlanlarım denemesi için ürün açıklaması yeterince uzun.', 3200, 'rate', 12, 'Yazıcı & Tarayıcı', 'İstanbul', 'active', 'open', 'TRY',
            '{"_root":"İkinci El & Sıfır Alışveriş","_leaf":"Yazıcı & Tarayıcı","_path":["ikinci-el-ve-sifir-alisveris","elektronik","yazici-ve-tarayici"]}'::jsonb)
    returning id;`).then((rows) => rows[0].id);
  const soldId = await insert("E2E Satilacak Urun", "e2e-satilacak");
  const deleteId = await insert("E2E Silinecek Urun", "e2e-silinecek");

  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 120_000 }); // ilk paketleme uzun sürer
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PW);
  await page.getByRole("button", { name: /giriş yap/i }).last().click();
  await page.waitForFunction(() => Object.keys(window.localStorage).some((k) => /^sb-.*-auth-token$/.test(k)), null, { timeout: 30_000 });
  await page.waitForTimeout(3000);

  // Uygulama içi gezinme (tam sayfa yüklemesi değil): geliştirme sunucusu bu sayfayı sunucuda çizerken
  // "Requiring unknown module" hatası verebiliyor; gerçek uygulamada da sayfa hep uygulama içinden açılır.
  await page.evaluate(() => { window.history.pushState({}, "", "/seller"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await expect(page.getByText("E2E Satilacak Urun").first(), "İlanlarım ekranında ilan görünmeli").toBeVisible({ timeout: 60_000 });
  const body = await page.locator("body").innerText();
  expect(body.includes("Mağazamı Gör") && body.includes("Mağaza Sırası"), "mağaza düğmeleri").toBeTruthy();
  expect(body.includes("İkinci El & Sıfır Alışveriş › Elektronik › Yazıcı & Tarayıcı"), "tam kategori yolu yazmalı").toBeTruthy();
  expect(body.includes("Ana sayfa, Keşfet, arama ve bu kategoride görünüyor."), "görünürlük cümlesi").toBeTruthy();
  await page.screenshot({ path: "e2e-artifacts/ilanlarim-1.png", fullPage: true });

  // Kartlar en yeni önce: 0 = silinecek, 1 = satılacak (aynı gün eklendi; hangisinin hangi sırada olduğu DB'den doğrulanır).
  const soldChips = page.getByRole("button", { name: "Satıldı", exact: true });
  const deleteChips = page.getByRole("button", { name: "Sil", exact: true });
  expect(await soldChips.count(), "her yayındaki ilanda Satıldı düğmesi").toBe(2);
  expect(await deleteChips.count(), "yayındaki ilanda da Sil düğmesi").toBe(2);

  // (1) İlk karttaki ilanı "Satıldı" işaretle.
  await soldChips.first().click();
  expect(await acceptConfirm(page, 6000), "Satıldı için onay penceresi çıkmalı").toBeTruthy();
  await page.waitForTimeout(3500);
  const afterSold = await runSql<Array<{ id: string; status: string }>>(`select id, status::text from listings where owner_id='${uid}'`);
  const sold = afterSold.filter((r) => r.status === "sold");
  expect(sold.length, "tam bir ilan 'sold' olmalı").toBe(1);
  expect(afterSold.filter((r) => r.status === "active").length, "diğeri yayında kalmalı").toBe(1);

  // (2) Yayında kalan ilanı doğrudan sil (önce yayından kaldırmadan).
  const stillActive = afterSold.find((r) => r.status === "active")!.id;
  const activeTitle = stillActive === soldId ? "E2E Satilacak Urun" : "E2E Silinecek Urun";
  await page.getByRole("button", { name: "Yayında", exact: false }).first().click().catch(() => {}); // Yayında sekmesi: yalnız yayındaki ilan kalır
  await page.waitForTimeout(800);
  await expect(page.getByText(activeTitle).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Sil", exact: true }).first().click();
  expect(await acceptConfirm(page, 6000), "Sil için onay penceresi çıkmalı").toBeTruthy();
  await page.waitForTimeout(4000);
  const afterDelete = await runSql<Array<{ id: string; status: string }>>(`select id, status::text from listings where owner_id='${uid}'`);
  const gone = afterDelete.find((r) => r.id === stillActive);
  expect(!gone || gone.status === "archived", `yayındaki ilan silinmiş ya da arşivlenmiş olmalı (durum: ${gone?.status ?? "silindi"})`).toBeTruthy();
  await page.screenshot({ path: "e2e-artifacts/ilanlarim-2.png", fullPage: true });

  console.log(`ILANLARIM OK: satıldı=${sold[0].id.slice(0, 8)}, silinen=${stillActive.slice(0, 8)} (${gone ? gone.status : "silindi"}); kullanılmayan kimlikler ${[soldId, deleteId].length}`);
  await runSql(`delete from listings where owner_id='${uid}'`);
});
