import { test, devices } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql, seedListing } from "./helpers/supabase-admin";

test.use({ ...devices["iPhone 13"] });
const PW = "GucluSifre123!";

test("mobil ekran görüntüleri (görsel denetim)", async ({ page }) => {
  test.setTimeout(240_000);
  const shot = async (path: string, name: string, waitFor = 2500) => {
    await page.goto(`https://ortaksat.com${path}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(waitFor);
    await page.screenshot({ path: `e2e-artifacts/ms-${name}.png`, fullPage: true });
  };
  // Anon browse
  await shot("/", "home");
  await shot("/explore", "explore");
  await shot("/kategori/emlak", "cat-emlak");
  // İlk aktif ilanı bul + detayına git
  const rows = await runSql<Array<{ id: string }>>("select id from listings where status='active' order by created_at desc limit 1").catch(() => []);
  if (rows[0]) await shot(`/listing/${rows[0].id}`, "listing");
  await shot("/create", "create");

  // Girişli
  const email = uniqueEmail("mshot");
  await createConfirmedUser(email, PW, "Görsel Test");
  await resetAuthRateLimits();
  await page.goto("https://ortaksat.com/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(6000);
  await shot("/(tabs)/profile", "profile");
  await shot("/(tabs)/seller", "seller");
  await shot("/(tabs)/partner", "partner");
  await shot("/(tabs)/messages", "messages");
  await shot("/(tabs)/menu", "menu");
  await shot("/earnings", "earnings");
});
