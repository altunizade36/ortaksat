// Mağaza (App Store / Google Play) ekran görüntülerini üretir → store/screenshots/.
//
// Uygulama arayüzü tarayıcıda çizilir (mobil önizleme sunucusu), girişsiz ziyaretçi gözüyle ve CANLI verilerle:
//   EXPO_PUBLIC_MOBILE_PREVIEW=1 npx expo start --port 8090 --localhost      (CI=1 VERME)
//   node scripts/store-screenshots.mjs [http://localhost:8090] [ilan-kimliği] [mağaza-sahibi-kimliği]
//
// Ölçüler: iPhone 6,7" = 1290×2796 (430×932 @3x) · Google Play telefon = 1080×1920 (360×640 @3x, 9:16).
// Kimlikler verilmezse ilk yayındaki ilan ve onun satıcısı kullanılır. Yüklemeden ÖNCE görselleri gözden geçir:
// ekranda başka satıcıların gerçek ilanları görünür.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const { chromium } = require("@playwright/test");
const base = process.argv[2] || "http://localhost:8090";
const seed = JSON.parse(readFileSync(join(root, "lib", "listing-seed.json"), "utf8"));
const listingId = process.argv[3] || seed[0]?.id;
const ownerId = process.argv[4] || seed.find((l) => l.id === listingId)?.owner_id || seed[0]?.owner_id;

const DEVICES = [
  { dir: "ios-6.7", viewport: { width: 430, height: 932 }, scale: 3 },
  { dir: "play-telefon", viewport: { width: 360, height: 640 }, scale: 3 }
];
const SCREENS = [
  { name: "01-ana-sayfa", path: "/" },
  { name: "02-kesfet", path: "/explore" },
  { name: "03-ilan-detayi", path: `/listing/${listingId}` },
  // Ortak Satış ekranı uygulamada giriş ister; misafir görüntüsü giriş ekranı olurdu → listede yok.
  { name: "04-magaza", path: `/store/${ownerId}` },
  { name: "05-kategoriler", path: "/kategoriler" }
];

const browser = await chromium.launch({ headless: true });
for (const device of DEVICES) {
  const out = join(root, "store", "screenshots", device.dir);
  mkdirSync(out, { recursive: true });
  const context = await browser.newContext({ viewport: device.viewport, deviceScaleFactor: device.scale, hasTouch: true, isMobile: true, locale: "tr-TR" });
  // Görüntüleme sayaçları kirlenmesin.
  await context.route("**/rpc/record_listing_view*", (route) => route.fulfill({ status: 204, body: "" }));
  await context.route("**/rpc/track_listing_event*", (route) => route.fulfill({ status: 204, body: "" }));
  const page = await context.newPage();
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(9000); // ilk paketleme + açılış animasyonu
  // Uygulama girişsiz ziyaretçiyi önce karşılama/giriş ekranına alır; "Geç" ile misafir olarak devam edilir.
  const skip = page.getByText("Geç", { exact: true }).first();
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(4000); }
  for (const screen of SCREENS) {
    // Uygulama içi gezinme: geliştirme sunucusunun sunucu tarafı çizim hatalarından etkilenmez.
    await page.evaluate((path) => { window.history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); }, screen.path);
    await page.waitForTimeout(5500);
    await page.screenshot({ path: join(out, `${screen.name}.png`) });
    console.log(device.dir, screen.name, "ok");
  }
  await context.close();
}
await browser.close();
