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

/** Yerleşim denetimi: taşma / açık listenin görünürlüğü. */
async function audit(page: Page, step: string) {
  const d = await page.evaluate(() => {
    const vh = window.innerHeight, vw = window.innerWidth;
    const overflowX = document.documentElement.scrollWidth - vw;
    const open = document.querySelector('[data-openlist="1"],[data-openloc="1"]') as HTMLElement | null;
    let openInfo: string | null = null;
    if (open) {
      const r = open.getBoundingClientRect();
      const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      openInfo = `açıkListe h=${Math.round(r.height)} görünen=${Math.round(vis)} (%${Math.round((vis / r.height) * 100)})`;
    }
    return { overflowX, openInfo };
  });
  const bad = d.overflowX > 1;
  console.log(`${bad ? "!!" : "ok"} [${step}] yatayTaşma=${d.overflowX}${d.openInfo ? " | " + d.openInfo : ""}`);
  return bad;
}

/** Görünen tüm "Seçin" kutularını GERÇEK DOKUNMA ile doldur. */
async function fillSelects(page: Page, step: string) {
  for (let guard = 0; guard < 25; guard++) {
    const box = page.getByText("Seçin", { exact: true }).first();
    if (!(await box.count()) || !(await box.isVisible().catch(() => false))) return;
    await box.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(250);
    if (!(await box.tap({ timeout: 5000 }).then(() => true).catch(() => false))) return;
    await page.waitForTimeout(1000);
    // açık listenin görünürlüğünü denetle
    await audit(page, `${step}/liste`);
    // İlk seçeneğin METNİNİ al, sonra o metne DOKUN (role=button hedeflemesi güvenilmez).
    const optText = await page.evaluate(() => {
      const el = document.querySelector('[data-openlist="1"]') as HTMLElement | null;
      if (!el) return null;
      const rows = Array.from(el.querySelectorAll("div")).filter((d) => {
        const t = (d as HTMLElement).innerText?.trim() ?? "";
        return t.length > 0 && t.length < 40 && (d as HTMLElement).getBoundingClientRect().height > 20;
      }) as HTMLElement[];
      return rows.length ? rows[rows.length - 1].innerText.trim().split("\n")[0] : null;
    });
    if (optText) {
      await page.locator('[data-openlist="1"]').getByText(optText, { exact: true }).first()
        .tap({ timeout: 5000 }).catch(() => {});
    } else {
      await box.tap().catch(() => {});
    }
    await page.waitForTimeout(800);
  }
}

async function fillInputs(page: Page) {
  for (const inp of await page.locator("input").all()) {
    if (!(await inp.isVisible().catch(() => false))) continue;
    if (await inp.inputValue().catch(() => "x")) continue;
    const ph = (await inp.getAttribute("placeholder")) ?? "";
    if (/ara|search|ne satıyorsun|mahalle/i.test(ph)) continue;
    await inp.fill("50000").catch(() => {});
  }
  for (const ta of await page.locator("textarea").all()) {
    if (!(await ta.isVisible().catch(() => false))) continue;
    if (await ta.inputValue().catch(() => "x")) continue;
    await ta.fill("Test ilan açıklaması. Ürün temiz ve bakımlıdır.").catch(() => {});
  }
}

test("iPHONE E2E: ilan verme akışının SONUNA kadar (tüm adımlar)", async ({ page }) => {
  page.on("console", (m) => { if (m.type() === "error") console.log("  BROWSER-ERR:", m.text().slice(0, 120)); });

  const email = uniqueEmail("ipe2e");
  await createConfirmedUser(email, PW, "E2E iPhone E2E");
  await login(page, email);

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1600);
  await page.locator("text=/›/").first().tap();
  await page.waitForTimeout(3000);

  for (let step = 2; step <= 6; step++) {
    const head = (await page.locator("body").innerText()).slice(0, 0);
    console.log(`\n--- ADIM ${step} ---`);
    await audit(page, `adım${step}`);
    await fillSelects(page, `adım${step}`);
    await fillInputs(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `e2e-artifacts/e2e-step${step}.png` });

    // Devam
    const next = page.getByText(/^(Devam|Yayınla|İlanı Yayınla)/).first();
    if (!(await next.count())) { console.log("  Devam/Yayınla butonu yok"); break; }
    const disabled = await next.evaluate((e) => {
      const st = getComputedStyle(e.closest('[role="button"]') ?? e);
      return parseFloat(st.opacity) < 0.7;
    }).catch(() => false);
    const label = (await next.innerText().catch(() => "?")).trim();
    console.log(`  buton="${label}" pasif=${disabled}`);
    // eksik alan uyarısı var mı?
    const body = await page.locator("body").innerText();
    const warn = body.match(/Zorunlu alanları doldur[^\n]*/);
    if (warn) console.log(`  !! UYARI: ${warn[0].slice(0, 90)}`);

    await next.tap({ timeout: 8000 }).catch(() => console.log("  buton tap edilemedi"));
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: "e2e-artifacts/e2e-final.png" });
  console.log("\n--- BİTTİ ---");
});
