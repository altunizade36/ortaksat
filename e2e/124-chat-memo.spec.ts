import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, seedConversation } from "./helpers/supabase-admin";

/**
 * SOHBET ekranı — memo'lu baloncuk listesi refactor'ı sonrası regresyon YOK doğrulaması:
 * seeded mesajlar RENDER olur + yeni mesaj gönderilince anında görünür (optimistik).
 */

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.setViewportSize({ width: 1280, height: 900 }); // giriş formu geniş viewport'ta stabil
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(4000);
}

test("Sohbet: seeded mesajlar render + yeni mesaj optimistik görünür (memo refactor regresyonsuz)", async ({ page }) => {
  const sellerId = await createConfirmedUser(uniqueEmail("chatsel"), PW, "E2E Chat Seller");
  const buyerEmail = uniqueEmail("chatbuy");
  const buyerId = await createConfirmedUser(buyerEmail, PW, "E2E Chat Buyer");
  const { conversationId } = await seedConversation(sellerId, buyerId);

  await login(page, buyerEmail);
  // Sohbet ekranı yalnız mobil (geniş web /messages'a yönlendirir) → mobil viewport'a geç.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/chat/${conversationId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);

  let body = await page.locator("body").innerText();
  expect(body, "seeded mesajlar render olmalı").toContain("koltuk");

  // Yeni mesaj gönder → optimistik anında görünmeli.
  const msg = `E2E memo test ${Date.now().toString(36)}`;
  const input = page.getByPlaceholder(/Mesaj yaz/i).first();
  await input.click();
  await input.fill(msg);
  await page.getByLabel("Gönder", { exact: true }).first().click();
  await page.waitForTimeout(2500);

  body = await page.locator("body").innerText();
  expect(body, "gönderilen mesaj sohbette görünmeli").toContain(msg);
  await page.screenshot({ path: "e2e-artifacts/chat-memo.png", fullPage: true });
});
