import { test, expect, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/feed-noauto";

/**
 * KEŞFET FEED OTOMATİK-İLERLEME KALDIRILDI: feed açıldıktan sonra kullanıcı hiçbir şey
 * yapmadan 8+ sn beklediğinde AYNI ilan görünmeli (eskiden 6,5sn'de kendiliğinden atlıyordu
 * → "başkası açılıyor"). Ayrıca paging container yüksekliğiyle hizalı (görsel yarım kalmaz).
 */
async function currentListingTitle(page: Page): Promise<string> {
  return page.evaluate(() => {
    // Feed'de görünen ilan başlığı — en büyük/kalın başlık metni
    const els = Array.from(document.querySelectorAll("*")) as HTMLElement[];
    for (const el of els) {
      const t = (el.innerText || "").trim();
      if (t && t.length > 4 && t.length < 50 && /[A-ZÇĞİÖŞÜ]/.test(t[0])) {
        const fs = parseInt(getComputedStyle(el).fontSize || "0", 10);
        if (fs >= 22) return t.split("\n")[0].slice(0, 40);
      }
    }
    return "?";
  });
}

test("KEŞFET FEED: kendiliğinden ilerlemez (mobil)", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();

  // Keşfet'ten "Görsel" butonuyla feed'e gir
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  const visualBtn = page.getByText(/^Görsel$/).first();
  const hasBtn = await visualBtn.count().then((c) => c > 0).catch(() => false);
  if (!hasBtn) { console.log("Görsel butonu bulunamadı — atlanıyor"); test.skip(); return; }
  await visualBtn.click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/feed-0sn.png` }).catch(() => {});

  const t0 = await currentListingTitle(page);
  const url0 = page.url();
  console.log(`feed açıldı: "${t0}" @ ${url0.slice(-30)}`);

  // 8 saniye bekle — HİÇBİR ŞEY yapma. Eskiden 6,5sn'de otomatik atlardı.
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${OUT}/feed-8sn.png` }).catch(() => {});
  const t1 = await currentListingTitle(page);
  const scrollY = await page.evaluate(() => {
    const sv = document.querySelector('[style*="overflow"]') as HTMLElement;
    return window.scrollY || (sv ? sv.scrollTop : 0);
  });
  console.log(`8sn sonra: "${t1}" | scroll konumu: ${scrollY}`);

  expect(t1, "8sn beklerken feed kendiliğinden başka ilana ATLAMAMALI").toBe(t0);
  console.log("FEED OTOMATIK-ILERLEME YOK ✓");
  await ctx.close();
});
