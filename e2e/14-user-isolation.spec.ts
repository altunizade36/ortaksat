import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, seedConversation, resetAuthRateLimits } from "./helpers/supabase-admin";

/**
 * Kullanıcı izolasyonu: çıkış yapınca önceki kullanıcının özel verisi (konuşmalar)
 * bellekten temizlenmeli; aynı tarayıcıda giriş yapan İKİNCİ kullanıcı, BİRİNCİ
 * kullanıcının konuşmalarını GÖRMEMELİ (resetPrivateState).
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

async function logout(page: Page) {
  await page.getByText(/Hesabım/i).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.getByText(/Çıkış Yap/i).first().click().catch(() => {});
  await page.waitForTimeout(3000);
}

test("Çıkış sonrası ikinci kullanıcı, birinci kullanıcının konuşmalarını görmez", async ({ page }) => {
  // Kullanıcı A: bir konuşması olan satıcı.
  const aEmail = uniqueEmail("isoA");
  const aId = await createConfirmedUser(aEmail, PW, "E2E Izolasyon A");
  const bId = await createConfirmedUser(uniqueEmail("isoAbuyer"), PW, "E2E Izolasyon A Alici");
  await seedConversation(aId, bId);
  // Kullanıcı C: taze, hiç konuşması yok.
  const cEmail = uniqueEmail("isoC");
  await createConfirmedUser(cEmail, PW, "E2E Izolasyon C");

  await page.setViewportSize({ width: 1280, height: 900 });

  // A giriş yapar → konuşmasını görür.
  await login(page, aEmail);
  await page.goto("/messages", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  let body = await page.locator("body").innerText();
  expect(body, "A kendi konuşmasını görmeli").toContain("Mesaj Koltuk");

  // A çıkış yapar.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await logout(page);

  // C giriş yapar → A'nın konuşması SIZMAMALI.
  await login(page, cEmail);
  await page.goto("/messages", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: "e2e-artifacts/iso-userC-messages.png", fullPage: true });
  body = await page.locator("body").innerText();
  expect(body, "C, A'nın konuşmasını GÖRMEMELİ (izolasyon)").not.toContain("Mesaj Koltuk");
});
