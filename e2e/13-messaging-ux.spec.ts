import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, seedConversation, resetAuthRateLimits } from "./helpers/supabase-admin";

/**
 * Mesajlaşma UX düzeltmelerinin canlı doğrulaması:
 *  - Görüşme listesinde durum etiketi (buildConversationContext.status) render edilir.
 *  - Mobil sohbet düzeni: composer altta sabit, mesajlar görünür (ScrollView flex:1).
 */

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(4000);
}

test("Masaüstü mesajlar: görüşme + durum etiketi görünür", async ({ page }) => {
  const sellerEmail = uniqueEmail("msgseller");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E Msg Satici");
  const buyerId = await createConfirmedUser(uniqueEmail("msgbuyer"), PW, "E2E Msg Alici");
  await seedConversation(sellerId, buyerId);
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, sellerEmail);
  await page.goto("/messages", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: "e2e-artifacts/msg-desktop-list.png", fullPage: true });
  const body = await page.locator("body").innerText();
  expect(body, "görüşme listede görünmeli").toContain("Mesaj Koltuk");
  expect(body, "durum etiketi görünmeli").toContain("Satış konuşması");
});

test("Mobil sohbet: composer altta sabit + mesajlar görünür (flex:1)", async ({ page }) => {
  const sellerEmail = uniqueEmail("mchatsel");
  const sId = await createConfirmedUser(sellerEmail, PW, "E2E MChat Satici");
  const bId = await createConfirmedUser(uniqueEmail("mchatbuy"), PW, "E2E MChat Alici");
  const { conversationId } = await seedConversation(sId, bId);
  // Girişi masaüstü boyutunda yap (auth formu mobilde farklı davranabiliyor), sonra
  // sohbet düzenini mobil boyutta sına.
  await login(page, sellerEmail);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/chat/${conversationId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: "e2e-artifacts/msg-mobile-chat.png", fullPage: true });

  const composer = page.getByPlaceholder(/mesaj yaz/i).first();
  await expect(composer, "mesaj yazma kutusu görünmeli").toBeVisible({ timeout: 15000 });
  const bodyText = await page.locator("body").innerText();
  expect(bodyText, "mesaj içeriği görünmeli").toMatch(/koltuk|stokta|teslimat|mevcut|yardımcı/i);

  // Composer viewport'un alt yarısında olmalı (flex:1 ile altta sabit; yukarı itilmemiş).
  const box = await composer.boundingBox();
  expect(box, "composer görünür kutu döndürmeli").toBeTruthy();
  expect(box!.y, "composer alt bölgede (y>430) olmalı").toBeGreaterThan(430);
});
