import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, seedConversation } from "./helpers/supabase-admin";

/**
 * MESAJ KUTUSU (masaüstü 3-panel) — ctxById/visibleConversations useMemo'lama sonrası
 * regresyon YOK: liste render + aktif konuşma mesajları + composer gönderim + arama filtresi.
 */

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(4000);
}

test("Mesaj kutusu masaüstü: liste + aktif mesajlar + gönderim + arama (memo regresyonsuz)", async ({ page }) => {
  const sellerId = await createConfirmedUser(uniqueEmail("inbsel"), PW, "E2E Inbox Seller");
  const buyerEmail = uniqueEmail("inbbuy");
  const buyerId = await createConfirmedUser(buyerEmail, PW, "E2E Inbox Buyer");
  const { conversationId } = await seedConversation(sellerId, buyerId);

  await login(page, buyerEmail);
  await page.goto(`/(tabs)/messages?c=${conversationId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  let body = await page.locator("body").innerText();
  expect(body, "aktif konuşma mesajları render olmalı").toContain("koltuk");

  // Masaüstü composer'dan gönder → optimistik görünmeli.
  const msg = `E2E inbox ${Date.now().toString(36)}`;
  const composer = page.getByPlaceholder("Mesaj yaz…").first();
  await composer.click();
  await composer.fill(msg);
  await page.getByLabel("Mesajı gönder", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  body = await page.locator("body").innerText();
  expect(body, "gönderilen mesaj görünmeli").toContain(msg);

  // Arama filtresi çalışıyor (memo sonrası) — başlıkta "Koltuk" geçen konuşma kalır.
  const search = page.getByPlaceholder("Görüşmelerde ara").first();
  await search.click();
  await search.fill("koltuk");
  await page.waitForTimeout(1200);
  body = await page.locator("body").innerText();
  expect(body, "arama eşleşen konuşmayı göstermeli").toContain("Koltuk");
  await page.screenshot({ path: "e2e-artifacts/messages-inbox.png", fullPage: true });
});
