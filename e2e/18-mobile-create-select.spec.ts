import { test, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const VW = 390;

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().click();
  await page.waitForTimeout(5000);
}

/** İç ScrollView'i (RN-web) bul ve kaydır. */
async function scrollInner(page: Page, dy: number) {
  await page.evaluate((d) => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("div"));
    const sc = els.find((e) => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== "visible");
    if (sc) sc.scrollTop += d;
  }, dy);
  await page.waitForTimeout(700);
}

test("MOBİL: kategori özniteliği seçici (dropdown) davranışı", async ({ page }) => {
  await page.setViewportSize({ width: VW, height: 844 });
  const email = uniqueEmail("mobilsel");
  await createConfirmedUser(email, PW, "E2E Mobil Select");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1500);
  await page.getByText(/Otomobil/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // "Seçin" (Marka) dropdown'ını aç
  const secin = page.getByText("Seçin", { exact: true }).first();
  await secin.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: "e2e-artifacts/s1-before-open.png" });
  await secin.click({ timeout: 8000 }).catch((e) => console.log("Seçin tıklanamadı:", e.message));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e-artifacts/s2-dropdown-open.png" });

  // Açık dropdown'ın ölçüleri: dev boş alan / taşma var mı?
  const info = await page.evaluate((vw) => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("div").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 700 && r.width > 100) {
        const txt = (el.innerText || "").trim();
        out.push(`h=${Math.round(r.height)} w=${Math.round(r.width)} top=${Math.round(r.top)} textLen=${txt.length} "${txt.slice(0, 30)}"`);
      }
    });
    return { vw, tall: out.slice(0, 10), bodyH: document.body.scrollHeight };
  }, VW);
  console.log("\n=== DROPDOWN AÇIK: uzun kutular ===");
  info.tall.forEach((t) => console.log("  " + t));

  // Bir marka seç
  const opt = page.getByText(/^(Audi|BMW|Mercedes|Volkswagen|Toyota|Renault|Ford)/).first();
  await opt.click({ timeout: 8000 }).catch((e) => console.log("marka seçilemedi:", e.message));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/s3-after-select.png" });

  // Seçim sonrası: sayfa aşağısı boş mu? üst üste binme?
  for (let i = 0; i < 4; i++) {
    await scrollInner(page, 700);
    await page.screenshot({ path: `e2e-artifacts/s4-scroll-${i}.png` });
  }
});
