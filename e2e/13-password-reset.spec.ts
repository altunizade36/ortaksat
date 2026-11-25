import { expect, test } from "@playwright/test";
import { apiSignIn, createConfirmedUser, resetAuthRateLimits, uniqueEmail } from "./helpers/supabase-admin";

// ŞİFREMİ UNUTTUM uçtan uca: arayüzden kod iste → (e-postayı okuyamayız) yönetici bağlantısıyla aynı türde taze kod
// üret → arayüzde kod + yeni şifre → yeni şifreyle API girişi. Masaüstü ve telefon genişliğinde koşar.
const REF = process.env.E2E_PROJECT_REF || "akyzzdwbzgsnhdircuce";
const SUPA_URL = process.env.E2E_SUPABASE_URL || "https://akyzzdwbzgsnhdircuce.supabase.co";

async function recoveryOtp(email: string): Promise<string> {
  const keys = (await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${process.env.E2E_SUPABASE_MGMT}` }
  })).json()) as Array<{ name?: string; type?: string; api_key: string }>;
  const sr = keys.find((k) => k.name === "service_role" || k.type === "secret")!.api_key;
  const res = await fetch(`${SUPA_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: sr, Authorization: `Bearer ${sr}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "recovery", email })
  });
  const body = (await res.json()) as { email_otp?: string };
  if (!body.email_otp) throw new Error("kurtarma kodu üretilemedi");
  return body.email_otp;
}

for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }]) {
  test(`şifre sıfırlama kodla tamamlanır (${viewport.width}px)`, async ({ page }) => {
    await resetAuthRateLimits();
    await page.setViewportSize(viewport);
    const email = uniqueEmail("reset");
    await createConfirmedUser(email, "EskiSifre123!", "E2E Sifirlama");

    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    // Telefonda giriş alanları "E-posta ile devam et" arkasında olabilir.
    const emailEntry = page.getByText("E-posta ile devam et", { exact: true });
    if (await emailEntry.isVisible().catch(() => false)) await emailEntry.click();
    await page.getByText("Şifremi unuttum", { exact: true }).first().click();
    await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
    await page.getByText("Sıfırlama kodu gönder", { exact: true }).last().click();
    await expect(page.getByPlaceholder("______")).toBeVisible({ timeout: 20_000 });

    const code = await recoveryOtp(email);
    await page.getByPlaceholder("______").fill(code);
    const newPassword = "YeniSifre456!";
    await page.getByPlaceholder(/güçlü bir şifre/i).first().fill(newPassword);
    await page.getByText("Kodu doğrula ve şifreyi güncelle", { exact: true }).last().click();

    await expect.poll(() => apiSignIn(email, newPassword), { timeout: 20_000 }).toBe(true);
    expect(await apiSignIn(email, "EskiSifre123!"), "eski şifre artık çalışmamalı").toBe(false);
  });
}
