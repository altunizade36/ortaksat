import { test, devices, type Page } from "@playwright/test";

const OUT = "e2e-artifacts/explore-feel";

test("KEŞFET his/akış denetimi (mobil)", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  // Başlangıçta kaç kart render? (fazla = ağır ilk boya)
  const initial = await page.evaluate(() => document.querySelectorAll('img[src*="/demo/"]').length);
  await page.screenshot({ path: `${OUT}/1-ust.png` }).catch(() => {});

  // Aşağı kaydır — yükle-daha çalışıyor mu, akıcı mı
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1600); await page.waitForTimeout(900); }
  const afterScroll = await page.evaluate(() => document.querySelectorAll('img[src*="/demo/"]').length);
  await page.screenshot({ path: `${OUT}/2-kaydirinca.png` }).catch(() => {});

  // Görsel placeholder (blur-up) var mı? expo-image placeholder/blurhash kullanıyor mu
  const imgInfo = await page.evaluate(() => {
    const im = document.querySelector('img[src*="/demo/"]') as HTMLImageElement;
    if (!im) return null;
    return { loading: im.getAttribute("loading"), decoding: im.getAttribute("decoding"), hasPlaceholder: !!im.style.backgroundImage };
  });
  console.log(`başlangıç kart:${initial} | kaydırma sonrası:${afterScroll} | img:${JSON.stringify(imgInfo)}`);

  // Feed'e gir (Görsel) — Instagram-vari etkileşimler var mı: çift-dokun beğeni?
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const gorsel = page.getByText(/^Görsel$/).first();
  if (await gorsel.count().then((c) => c > 0).catch(() => false)) {
    await gorsel.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/3-feed.png` }).catch(() => {});
    const feedInfo = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasLike: /Favori|Beğen/i.test(body),
        hasComment: /Yorum|Mesaj/i.test(body),
        hasShare: /Paylaş/i.test(body),
        hasCounter: /\d+\/\d+/.test(body)
      };
    });
    console.log(`FEED etkileşim: ${JSON.stringify(feedInfo)}`);
  }
  await ctx.close();
});
