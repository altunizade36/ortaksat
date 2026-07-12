import { test, expect, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const VW = 390; // iPhone 12/13/14 genişliği

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().click();
  await page.waitForTimeout(5000);
}

/** Yerleşim teşhisi: yatay taşma + viewport'u aşan öğeler + dev boş alan. */
async function diagnose(page: Page, label: string) {
  const d = await page.evaluate((vw) => {
    const de = document.documentElement;
    const overflowX = de.scrollWidth - vw;
    // Viewport'un sağına taşan görünür öğeler
    const offenders: Array<{ tag: string; cls: string; right: number; w: number; text: string }> = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none") return;
      if (r.right > vw + 1 || r.left < -1) {
        if (el.children.length > 4) return; // konteynerleri değil yaprakları raporla
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 40),
          right: Math.round(r.right),
          w: Math.round(r.width),
          text: (el.innerText || "").trim().slice(0, 40)
        });
      }
    });
    // En alttaki gerçek içerik → altta kalan boş alan
    let maxBottom = 0;
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > 0 && (el.innerText || "").trim()) {
        maxBottom = Math.max(maxBottom, r.bottom + window.scrollY);
      }
    });
    return {
      pageHeight: de.scrollHeight,
      contentBottom: Math.round(maxBottom),
      blankBelow: Math.round(de.scrollHeight - maxBottom),
      overflowX,
      offenders: offenders.slice(0, 12)
    };
  }, VW);
  console.log(`\n===== [${label}] =====`);
  console.log(`  yatay taşma: ${d.overflowX}px | sayfa: ${d.pageHeight}px | içerik sonu: ${d.contentBottom}px | ALTTA BOŞLUK: ${d.blankBelow}px`);
  if (d.offenders.length) {
    console.log(`  TAŞAN ÖĞELER (${d.offenders.length}):`);
    d.offenders.forEach((o) => console.log(`   - <${o.tag}> right=${o.right} w=${o.w} "${o.text}"`));
  }
  return d;
}

test("MOBİL WEB ilan verme akışı: taşma/boşluk/üst-üste binme teşhisi", async ({ page }) => {
  page.on("console", (m) => { if (m.type() === "error") console.log("BROWSER ERR:", m.text().slice(0, 160)); });
  await page.setViewportSize({ width: VW, height: 844 });

  const email = uniqueEmail("mobilcreate");
  await createConfirmedUser(email, PW, "E2E Mobil Create");
  await login(page, email);

  // 1) Create sayfası — kategori seçici
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "e2e-artifacts/m1-picker.png", fullPage: true });
  const d1 = await diagnose(page, "1 - kategori seçici");

  // 2) Kategori ara + seç (Otomobil → derin form)
  const search = page.getByPlaceholder(/ne satıyorsun/i).first();
  await search.fill("otomobil");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/m2-suggest.png", fullPage: true });
  await diagnose(page, "2 - öneri listesi");

  await page.getByText(/Otomobil/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e-artifacts/m3-form.png", fullPage: true });
  const d3 = await diagnose(page, "3 - kategori seçildi (FORM)");

  // 3) Formu doldur → sonraki adımlar
  await page.getByPlaceholder(/başlık|ilan başlığı/i).first().fill("Test Audi A4 2020").catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e-artifacts/m4-filled.png", fullPage: true });
  await diagnose(page, "4 - form dolduruldu");

  // "Devam"/"İleri" adımını dene
  await page.getByText(/^(Devam|İleri|Sonraki)/i).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/m5-step2.png", fullPage: true });
  await diagnose(page, "5 - sonraki adım");

  // Taşma OLMAMALI
  expect(d1.overflowX, "kategori seçicide yatay taşma olmamalı").toBeLessThanOrEqual(1);
  expect(d3.overflowX, "form adımında yatay taşma olmamalı").toBeLessThanOrEqual(1);
  // Altta dev boş beyaz alan OLMAMALI (kullanıcı şikayeti)
  expect(d3.blankBelow, "form altında dev boş alan olmamalı").toBeLessThan(400);
});
