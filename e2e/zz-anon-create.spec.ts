import { test, expect } from "@playwright/test";

// Anonim create: kayıt duvarı BAŞTA çıkmamalı — ziyaretçi formu görebilmeli (kapı yalnız Yayınla'da).
// Yerel dist-web (8099); sunucu yoksa atla.
const BASE = "http://localhost:8099";
test.beforeAll(async () => { try { await fetch(BASE + "/"); } catch { test.skip(true, "8099 kapalı"); } });

function trackErrors(page: import("@playwright/test").Page) {
  const e: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") e.push(m.text()); });
  page.on("pageerror", (x) => e.push(String(x)));
  return e;
}

test("anonim /create formu gösteriyor (giriş duvarı değil), #418 yok", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(BASE + "/create", { waitUntil: "networkidle" });
  await page.waitForTimeout(1800); // mount + form
  const body = await page.locator("body").innerText();
  // Kayıt duvarının BİRİNCİL metni görünmemeli (form görünmeli). Duvar metni:
  const wallVisible = /İlan vermek için giriş yapın/i.test(body);
  expect(wallVisible, "anonim kullanıcı hâlâ giriş duvarı görüyor").toBeFalsy();
  // Form/adım işareti görünmeli (kategori seçimi / adım / ilan başlığı gibi bir sinyal)
  const formSignal = /kategori|adım|ilan|başlık|fiyat|komisyon|devam/i.test(body);
  expect(formSignal, "create formu render olmadı").toBeTruthy();
  const hydration = errors.filter((e) => /418|hydrat|did not match|Minified React/i.test(e));
  expect(hydration, "hydration:\n" + hydration.join("\n")).toHaveLength(0);
});
