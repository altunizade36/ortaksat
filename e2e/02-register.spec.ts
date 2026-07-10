import { test, expect } from "@playwright/test";
import { uniqueEmail, getUserId, confirmUser } from "./helpers/supabase-admin";

/**
 * YAZMA akışı: gerçek kayıt. Round-2 #2'nin (kayıt sonsuza dek "Kayıt açılıyor…"
 * takılı) canlıda çözüldüğünü doğrular: form gönderilince 6-haneli KOD ekranı
 * gelmeli. Oluşan test hesabı global-teardown'da silinir.
 */
test("kayıt tamamlanır → kod ekranı gelir (takılmaz) + hesap DB'de oluşur", async ({ page }) => {
  const email = uniqueEmail("reg");
  const password = "GucluSifre123!";

  await page.goto("/auth?mode=register", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Ad / Soyad
  await page.getByPlaceholder("Ayşe").fill("E2E");
  await page.getByPlaceholder("Demir").fill("Test");
  // E-posta
  await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
  // Şifre + tekrar
  const pwFields = page.getByPlaceholder(/şifre/i);
  await pwFields.nth(0).fill(password);
  await pwFields.nth(1).fill(password);
  // KVKK checkbox (role=checkbox)
  const checkbox = page.getByRole("checkbox").first();
  await checkbox.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "e2e-artifacts/register-filled.png", fullPage: true });

  // Kayıt Ol — DİKKAT: "Kayıt Ol" hem sekme hem gönder butonu; gönder butonu SON eşleşmedir.
  const t0 = Date.now();
  await page.getByText("Kayıt Ol", { exact: true }).last().click();

  // Autoconfirm AÇIK (mailer_autoconfirm=true): kayıt session'ı ANINDA döndürür → otomatik giriş
  // → /hosgeldin veya / yönlendirmesi (KOD EKRANI YOK, e-posta yok, hiçbir limite takılmaz).
  // Eski akış (kod ekranı) da kabul edilir. ASLA "Çok sık denediniz" ile bloklanmamalı.
  const codeScreen = page.getByText("E-postanı doğrula").first();
  const rateLimited = page.getByText(/çok sık|biraz sonra|kayıt yapılamadı/i).first();
  await Promise.race([
    page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 40_000 }).catch(() => {}),
    codeScreen.waitFor({ state: "visible", timeout: 40_000 }).catch(() => {}),
    rateLimited.waitFor({ state: "visible", timeout: 40_000 }).catch(() => {})
  ]);
  const loggedIn = !new URL(page.url()).pathname.startsWith("/auth");
  const gotCode = await codeScreen.isVisible().catch(() => false);
  const blocked = await rateLimited.isVisible().catch(() => false);
  console.log(`[register] ${((Date.now() - t0) / 1000).toFixed(1)}s: loggedIn=${loggedIn} code=${gotCode} blocked=${blocked}`);
  await page.screenshot({ path: "e2e-artifacts/register-result.png", fullPage: true });

  expect(blocked, "kayıt rate-limit/hata ile bloklanmamalı (autoconfirm sonrası)").toBe(false);
  expect(loggedIn || gotCode, "kayıt başarılı olmalı: otomatik giriş VEYA kod ekranı").toBe(true);
  const stuck = await page.getByText(/Kayıt açılıyor/i).count();
  expect(stuck, "buton 'Kayıt açılıyor…' halinde takılı kalmamalı").toBe(0);

  await page.waitForTimeout(1200);
  const uid = await getUserId(email);
  expect(uid, "kayıt olan hesap auth.users'ta bulunmalı").toBeTruthy();
  if (gotCode) await confirmUser(email);
});
