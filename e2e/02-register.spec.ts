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

  // Kayıt Ol — DİKKAT: "Kayıt Ol" hem sekme hem gönder butonu; gönder butonu
  // (sekmeden sonra, formun altında) SON eşleşmedir.
  const t0 = Date.now();
  await page.getByText("Kayıt Ol", { exact: true }).last().click();

  // KRİTİK (Round-2 #2): buton "Kayıt açılıyor…" halinde SONSUZA DEK TAKILMAMALI.
  // Kabul: (a) kod ekranı ("E-postanı doğrula"), VEYA (b) GoTrue e-posta hız
  // sınırı nedeniyle net hata (yine takılma yok — asıl bug buydu).
  const codeScreen = page.getByText("E-postanı doğrula").first();
  const rateLimited = page.getByText(/çok sık|biraz sonra|kayıt yapılamadı/i).first();
  await expect(codeScreen.or(rateLimited)).toBeVisible({ timeout: 40_000 });
  const gotCode = await codeScreen.isVisible();
  console.log(`[register] ${((Date.now() - t0) / 1000).toFixed(1)}s: ${gotCode ? "KOD EKRANI geldi ✓" : "hız-sınırı hatası (takılma yok) ✓"}`);
  await page.screenshot({ path: "e2e-artifacts/register-result.png", fullPage: true });

  const stuck = await page.getByText(/Kayıt açılıyor/i).count();
  expect(stuck, "buton 'Kayıt açılıyor…' halinde takılı kalmamalı").toBe(0);

  if (gotCode) {
    await page.waitForTimeout(1200);
    const uid = await getUserId(email);
    expect(uid, "kayıt olan hesap auth.users'ta bulunmalı").toBeTruthy();
    await confirmUser(email);
  }
});
