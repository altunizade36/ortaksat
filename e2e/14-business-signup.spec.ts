import { expect, test } from "@playwright/test";
import { resetAuthRateLimits, runSql, uniqueEmail } from "./helpers/supabase-admin";

// KURUMSAL HESAP: /auth?mode=register&tur=kurumsal → işletme bilgileriyle kayıt → oturum açılır,
// profil adı işletme adı olur ve beyan bilgileri business_accounts'a yazılır (yalnız sahibi + yönetici okur).
for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`kurumsal hesap açılır ve işletme kaydı oluşur (${viewport.width}px)`, async ({ page }) => {
    await resetAuthRateLimits();
    await page.setViewportSize(viewport);
    const email = uniqueEmail("biz");
    const businessName = `E2E Deneme Ticaret ${viewport.width}`;

    await page.goto("/auth?mode=register&tur=kurumsal", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Kurumsal hesap aç" })).toBeVisible({ timeout: 20_000 });
    // Kurumsal formda sosyal giriş yok (işletme bilgileri gerekir).
    await expect(page.getByText("Google ile kaydol", { exact: true })).toHaveCount(0);

    await page.getByPlaceholder("Mağazanda görünecek ad").fill(businessName);
    await page.getByText("Limited veya anonim şirket", { exact: true }).click();
    await page.getByRole("button", { name: /^İl:/ }).click();
    await page.getByText("Ankara", { exact: true }).last().click();
    await page.getByPlaceholder("Ayşe").fill("E2E");
    await page.getByPlaceholder("Demir").fill("Yetkili");
    await page.getByPlaceholder(/eposta|e-posta|@/i).first().fill(email);
    const passwords = page.getByPlaceholder(/şifre/i);
    await passwords.nth(0).fill("GucluSifre123!");
    await passwords.nth(1).fill("GucluSifre123!");
    await page.getByRole("checkbox").first().click();
    await page.getByText("Kurumsal hesap aç", { exact: true }).last().click();

    await page.waitForURL((u) => !u.pathname.startsWith("/auth") && !u.pathname.startsWith("/giris"), { timeout: 40_000 });

    await expect.poll(async () => {
      const rows = await runSql<Array<{ business_name: string; business_type: string; city: string; contact_name: string; full_name: string }>>(
        `select b.business_name, b.business_type, b.city, b.contact_name, p.full_name
           from auth.users u join public.business_accounts b on b.user_id = u.id join public.profiles p on p.id = u.id
          where u.email = '${email}'`
      );
      return rows[0] ?? null;
    }, { timeout: 20_000 }).toEqual({ business_name: businessName, business_type: "sirket", city: "Ankara", contact_name: "E2E Yetkili", full_name: businessName });
  });
}
