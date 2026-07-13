import { test } from "@playwright/test";

test("Google onay ekranı hangi uygulama adını gösteriyor?", async ({ page }) => {
  test.setTimeout(120_000);
  // Supabase'in Google OAuth başlatma uç noktası (uygulamanın kullandığı akışın aynısı)
  const url = "https://akyzzdwbzgsnhdircuce.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://www.ortaksat.com";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  console.log("\nSON URL:", page.url());
  const text = (await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 600);
  console.log("\nEKRAN METNİ:", text);
  // Uygulama adını içeren tipik ifadeleri ara
  for (const kw of ["Outscraper", "OrtakSat", "ortaksat", "supabase"]) {
    if (text.toLowerCase().includes(kw.toLowerCase())) console.log(`>>> EKRANDA GEÇİYOR: "${kw}"`);
  }
  await page.screenshot({ path: "e2e-artifacts/google-consent.png", fullPage: true });
});
