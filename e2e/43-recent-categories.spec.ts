import { test, devices, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

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

test("Son kullandığın kategoriler: seçim sonrası çip olarak çıkıyor ve tek dokunuşla forma götürüyor", async ({ page }) => {
  const email = uniqueEmail("recat");
  await createConfirmedUser(email, PW, "E2E RecentCat");
  await login(page, email);

  // 1) İlk kez: kategori seç (arama ile)
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const before = await page.locator("body").innerText();
  console.log(`İlk açılışta "Son kullandığın" var mı? ${/Son kullandığın/.test(before) ? "EVET (beklenmez)" : "hayır (doğru)"}`);

  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1500);
  await page.locator("text=/›/").first().tap();
  await page.waitForTimeout(2800);
  const inForm = /İlan başlığı/.test(await page.locator("body").innerText());
  console.log(`Kategori seçildi, forma girildi mi? ${inForm ? "EVET" : "HAYIR"}`);

  // 2) Create'i yeniden aç → çip görünmeli
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  // taslak geri yükleme sorulabilir; kategori seçiciye dönmek için "Değiştir"e bas
  await page.getByText(/Değiştir|Kategoriyi değiştir/).first().tap({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const body = await page.locator("body").innerText();
  const hasChip = /Son kullandığın kategoriler/.test(body);
  console.log(`Tekrar açılışta "Son kullandığın kategoriler" görünüyor mu? ${hasChip ? "EVET ✓" : "HAYIR ✗"}`);
  await page.screenshot({ path: "e2e-artifacts/recent-cats.png" });

  if (hasChip) {
    // 3) ÇİPE dokun (taslak bandındaki aynı metinle karışmasın → accessibilityLabel ile hedefle)
    const chip = page.getByRole("button", { name: /Vasıta › .*Otomobil/ }).first();
    console.log(`Çip bulundu mu: ${(await chip.count()) > 0}`);
    await chip.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await chip.tap({ timeout: 6000 }).catch((e) => console.log("çip tap hata:", e.message.slice(0, 50)));
    await page.waitForTimeout(2500);
    const back = /İlan başlığı/.test(await page.locator("body").innerText());
    console.log(`Çipe dokununca forma gitti mi? ${back ? "EVET ✓" : "HAYIR ✗"}`);
    expect(back, "son kullanılan kategori çipi tek dokunuşla forma götürmeli").toBe(true);
  }
  expect(hasChip, "kategori seçtikten sonra çip görünmeli").toBe(true);
});
