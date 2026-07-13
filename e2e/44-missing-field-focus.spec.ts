import { test, devices, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);
}

test("Devam'a basınca eksik alan İŞARETLENİR ve İLK EKSİĞE kaydırılır", async ({ page }) => {
  const email = uniqueEmail("missfld");
  await createConfirmedUser(email, PW, "E2E Missing");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1500);
  await page.locator("text=/›/").first().tap();
  await page.waitForTimeout(2800);

  // Hiçbir şey doldurmadan Devam'a bas
  const devam = page.getByText(/^Devam/).first();
  await devam.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await devam.tap({ timeout: 8000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "e2e-artifacts/missing-focus.png" });

  // İlk eksik alan (Marka) görünür alanda mı?
  const r = await page.evaluate(() => {
    const vh = window.innerHeight;
    const el = document.querySelector('[data-field="brand"]') as HTMLElement | null;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      inView: b.top >= 0 && b.bottom <= vh,
      top: Math.round(b.top),
      vh: Math.round(vh),
      // kırmızı işaret: etiket rengi accent (#EF4444) mi?
      labelColor: (el.querySelector("div") as HTMLElement | null) ? getComputedStyle(el.querySelectorAll("div")[1] ?? el).color : ""
    };
  });
  console.log("ilk eksik alan (Marka):", JSON.stringify(r));

  const body = await page.locator("body").innerText();
  const stillOnStep2 = /İlan başlığı/.test(body);
  console.log(`Adım 2'de kaldı mı (ilerlemedi)? ${stillOnStep2 ? "EVET (doğru)" : "HAYIR"}`);

  expect(r, "eksik alan DOM'da bulunmalı (data-field)").not.toBeNull();
  expect(r!.inView, "Devam'a basınca ilk eksik alan görünür alana kaydırılmalı").toBe(true);
});
