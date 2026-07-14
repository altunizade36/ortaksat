import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, runSql } from "./helpers/supabase-admin";

const OUT = "e2e-artifacts/detail-specs";
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

/**
 * İLAN DETAYI ÖZELLİK TABLOSU: detay sayfası kategoriye özel öznitelikleri "İlan Bilgileri"
 * (skaler: Yıl/KM/Yakıt…) + "Özellikler & Donanım" (çip) olarak gösteriyor mu? Tüm canlı
 * ilanlar demo (özniteliksiz) olduğundan, öznitelikli GERÇEK bir ilan oluşturup görüntülüyoruz.
 */
test("İLAN DETAYI: kategoriye özel özellik tablosu render olur", async ({ browser }) => {
  test.setTimeout(200_000);

  const email = uniqueEmail("specseller");
  const sellerId = await createConfirmedUser(email, "GucluSifre123!", "E2E SpecSatici");

  const attrs = JSON.stringify({
    brand: "BMW", model: "320i", year: "2018", km: "45000", fuel: "Benzin",
    gear: "Otomatik", bodyType: "Sedan", color: "Siyah",
    features: ["ABS", "Cam Tavan", "Geri Görüş Kamerası", "Deri Döşeme"]
  });
  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode, attributes)
    values (gen_random_uuid(), '${sellerId}', 'E2E BMW 320i Spec Test',
            'e2e-spec-' || substr(md5(random()::text),1,8), 'İstanbul', 'Temiz aile aracı, tam bakımlı.',
            'Otomobil', 850000, 'rate', 5, 'active', 1, false, 'open', '${attrs}'::jsonb)
    returning id`);
  const id = l!.id;

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const page = await ctx.newPage();
  await page.goto(`/listing/${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/d-bmw.png`, fullPage: true }).catch(() => {});

  const body = await page.locator("body").innerText();
  // İlan Bilgileri skaler tablo
  expect(body.includes("İlan Bilgileri"), "İlan Bilgileri tablosu olmalı").toBeTruthy();
  const scalarHits = ["2018", "45", "Benzin", "Otomatik", "Sedan"].filter((s) => body.includes(s));
  console.log(`skaler özellikler görünen: ${scalarHits.join(", ")}`);
  expect(scalarHits.length, "skaler özellikler görünmeli").toBeGreaterThanOrEqual(3);
  // gear → "Vites" Türkçe etiketi olmalı; ham İngilizce anahtar ("gear") SIZMAMALI.
  expect(body.includes("Vites"), "gear alanı 'Vites' etiketiyle görünmeli").toBeTruthy();
  expect(/\bgear\b/.test(body), "ham 'gear' anahtarı sızmamalı").toBeFalsy();
  // Donanım çipleri
  const featHits = ["ABS", "Cam Tavan", "Geri Görüş", "Deri"].filter((s) => body.includes(s));
  console.log(`donanım çipleri görünen: ${featHits.join(", ")}`);
  expect(featHits.length, "donanım çipleri görünmeli").toBeGreaterThanOrEqual(2);

  // mobil de
  const mctx = await browser.newContext({ ...devices["iPhone 13"] });
  const mp = await mctx.newPage();
  await mp.goto(`/listing/${id}`, { waitUntil: "domcontentloaded" });
  await mp.waitForTimeout(4000);
  await mp.screenshot({ path: `${OUT}/m-bmw.png`, fullPage: true }).catch(() => {});
  await mctx.close();

  console.log("OZELLIK TABLOSU OK");
  await ctx.close();
  await runSql(`delete from listings where id='${id}'`);
});
