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
  // PERF: eskiden İKİ tam `body *` taraması vardı ve her öğede getComputedStyle + innerText
  // çağrılıyordu — ikisi de senkron layout zorlar. Kategori formları zenginleştikçe (4700px+,
  // binlerce öğe) bu enstrümantasyon RENDERER'I ÇÖKERTİYORDU ("Target page has been closed") →
  // test, uygulamada olmayan bir hatayı raporluyordu. Artık: TEK tarama + üst sınır +
  // getComputedStyle YOK (rect boyutu görünürlük göstergesi) + innerText yerine textContent.
  const d = await page.evaluate((vw) => {
    const de = document.documentElement;
    const overflowX = de.scrollWidth - vw;
    const offenders: Array<{ tag: string; cls: string; right: number; w: number; text: string }> = [];
    let maxBottom = 0;
    const all = Array.from(document.querySelectorAll<HTMLElement>("body *")).slice(0, 4000);
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // görünmez/çökük → atla
      const txt = (el.textContent || "").trim();
      if (txt) maxBottom = Math.max(maxBottom, r.bottom + window.scrollY);
      if ((r.right > vw + 1 || r.left < -1) && el.children.length <= 4 && offenders.length < 12) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 40),
          right: Math.round(r.right),
          w: Math.round(r.width),
          text: txt.slice(0, 40)
        });
      }
    }
    return {
      pageHeight: de.scrollHeight,
      contentBottom: Math.round(maxBottom),
      blankBelow: Math.round(de.scrollHeight - maxBottom),
      overflowX,
      offenders
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
  await page.screenshot({ path: "e2e-artifacts/m1-picker.png" });
  const d1 = await diagnose(page, "1 - kategori seçici");

  // 2) Kategori ara + seç (Otomobil → derin form)
  const search = page.getByPlaceholder(/ne satıyorsun/i).first();
  await search.fill("otomobil");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-artifacts/m2-suggest.png" });
  await diagnose(page, "2 - öneri listesi");

  await page.getByText(/Otomobil/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e-artifacts/m3-form.png" });
  const d3 = await diagnose(page, "3 - kategori seçildi (FORM)");

  // 3) Formu doldur → sonraki adımlar
  await page.getByTestId("field-title").first().fill("Test Audi A4 2020").catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e-artifacts/m4-filled.png" });
  await diagnose(page, "4 - form dolduruldu");

  // "Devam"/"İleri" adımını dene
  await page.getByText(/^(Devam|İleri|Sonraki)/i).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-artifacts/m5-step2.png" });
  await diagnose(page, "5 - sonraki adım");

  // Taşma OLMAMALI
  expect(d1.overflowX, "kategori seçicide yatay taşma olmamalı").toBeLessThanOrEqual(1);
  expect(d3.overflowX, "form adımında yatay taşma olmamalı").toBeLessThanOrEqual(1);
  // Altta dev boş beyaz alan OLMAMALI (kullanıcı şikayeti)
  expect(d3.blankBelow, "form altında dev boş alan olmamalı").toBeLessThan(400);
});
