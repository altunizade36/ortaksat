import { test, expect } from "@playwright/test";

// asyncRoutes (kod-bölme) doğrulaması — yerel dist-web'e karşı (localhost:8099).
// Amaç: home hydration kırılmadı mı (#418), lazy route chunk'ları yükleniyor mu.
const BASE = "http://localhost:8099";

// Bu suite YEREL build doğrulaması içindir (npm run build:web + npm run serve:web).
// Canlı E2E turunda localhost:8099 ayakta değildir → sessizce atla, suite'i kırma.
test.beforeAll(async () => {
  try {
    await fetch(BASE + "/", { method: "HEAD" });
  } catch {
    test.skip(true, "yerel dist-web sunucusu (8099) kapalı — asyncRoutes doğrulaması atlandı");
  }
});

function trackErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("home hydrate eder, #418 yok, içerik görünür", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await expect(page.getByText(/ortak|keşfet|kazan/i).first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const hydration = errors.filter((e) => /418|hydrat|did not match|Minified React/i.test(e));
  expect(hydration, "hydration hatası:\n" + hydration.join("\n")).toHaveLength(0);
});

test("lazy route: /create chunk yüklenir ve form render olur", async ({ page }) => {
  const errors = trackErrors(page);
  const chunks: string[] = [];
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/js/web/create-") && u.endsWith(".js")) chunks.push(u);
  });
  await page.goto(BASE + "/create", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const chunkErr = errors.filter((e) => /Loading chunk|ChunkLoadError|import\(\)|Failed to fetch dynamically/i.test(e));
  expect(chunkErr, "chunk yükleme hatası:\n" + chunkErr.join("\n")).toHaveLength(0);
  // Sayfa bir şey render etmiş olmalı (boş beyaz ekran değil)
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.length, "boş ekran").toBeGreaterThan(30);
});

test.describe("mobil viewport", () => {
  test("mobil home hydrate eder, #418 yok", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = trackErrors(page);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await expect(page.getByText(/ortak|keşfet|kazan/i).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const hydration = errors.filter((e) => /418|hydrat|did not match|Minified React/i.test(e));
    expect(hydration, "mobil hydration hatası:\n" + hydration.join("\n")).toHaveLength(0);
    // 320px yatay taşma regresyonu olmasın
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, "mobil yatay taşma").toBeFalsy();
  });
});

test("client-side nav: home → keşfet lazy geçiş", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(BASE + "/explore", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.length).toBeGreaterThan(30);
  const fatal = errors.filter((e) => /ChunkLoadError|Loading chunk|is not a function|undefined is not/i.test(e));
  expect(fatal, fatal.join("\n")).toHaveLength(0);
});
