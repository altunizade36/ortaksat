import { test, devices, type Page } from "@playwright/test";
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

async function openCreate(page: Page) {
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1600);
  await page.locator("text=/›/").first().tap();
  await page.waitForTimeout(3000);
}

test("iPHONE: seçenek GERÇEK DOKUNMA ile seçiliyor mu?", async ({ page }) => {
  const email = uniqueEmail("taponly");
  await createConfirmedUser(email, PW, "E2E Tap");
  await login(page, email);
  await openCreate(page);

  // Marka'yı aç
  const marka = page.getByText("Seçin", { exact: true }).first();
  await marka.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await marka.tap();
  await page.waitForTimeout(1300);

  // Listedeki "Audi" seçeneğine GERÇEK DOKUNMA
  const audi = page.getByText("Audi", { exact: true }).first();
  const visible = await audi.isVisible().catch(() => false);
  console.log(`"Audi" seçeneği görünür mü: ${visible}`);
  if (visible) {
    await audi.tap({ timeout: 6000 }).catch((e) => console.log("tap hata:", e.message.slice(0, 60)));
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: "e2e-artifacts/tap-after.png" });

  const body = await page.locator("body").innerText();
  const selected = /Marka[\s\S]{0,40}Audi/i.test(body);
  const stillSecin = /Marka \*[\s\S]{0,20}Seçin/i.test(body);
  console.log(`\nDOKUNMA SONUCU → Marka="Audi" mi? ${selected ? "EVET ✓" : "HAYIR ✗"}   (hâlâ "Seçin" mi? ${stillSecin})`);
});

test("iPHONE: seçenek JS click ile seçiliyor mu? (karşılaştırma)", async ({ page }) => {
  const email = uniqueEmail("clickonly");
  await createConfirmedUser(email, PW, "E2E Click");
  await login(page, email);
  await openCreate(page);

  const marka = page.getByText("Seçin", { exact: true }).first();
  await marka.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await marka.tap();
  await page.waitForTimeout(1300);

  const ok = await page.evaluate(() => {
    const el = document.querySelector('[data-openlist="1"]') as HTMLElement | null;
    if (!el) return "liste-yok";
    const opts = Array.from(el.querySelectorAll('[role="button"]')) as HTMLElement[];
    const audi = opts.find((o) => (o.innerText || "").trim() === "Audi");
    if (!audi) return "audi-yok";
    audi.click();
    return "tiklandi";
  });
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  console.log(`\nJS CLICK → ${ok}; Marka="Audi" mi? ${/Marka[\s\S]{0,40}Audi/i.test(body) ? "EVET" : "HAYIR"}`);
});
