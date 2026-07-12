import { test, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().click();
  await page.waitForTimeout(5000);
}

test("BOŞLUK SUÇLUSU: scroll konteynerini şişiren öğe kim?", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = uniqueEmail("blank");
  await createConfirmedUser(email, PW, "E2E Blank");
  await login(page, email);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1500);
  await page.getByText(/Otomobil/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const report = await page.evaluate(() => {
    // ana scroll konteyneri = en büyük scrollHeight'lı scrollable div
    const divs = Array.from(document.querySelectorAll<HTMLElement>("div"));
    const scrollables = divs.filter((e) => {
      const st = getComputedStyle(e);
      return (st.overflowY === "auto" || st.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 20;
    });
    scrollables.sort((a, b) => b.scrollHeight - a.scrollHeight);
    const sc = scrollables[0];
    if (!sc) return { err: "scroll konteyner yok" };

    const scRect = sc.getBoundingClientRect();
    const toLocal = (r: DOMRect) => r.top - scRect.top + sc.scrollTop;

    // konteyner içindeki TÜM öğeler: en alta uzanan ve METİNSİZ olanlar = şişiren
    const rows: Array<{ tag: string; h: number; top: number; bottom: number; hasText: boolean; text: string; cls: string }> = [];
    sc.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 100) return;
      const txt = (el.innerText || "").trim();
      rows.push({
        tag: el.tagName.toLowerCase(),
        h: Math.round(r.height),
        top: Math.round(toLocal(r)),
        bottom: Math.round(toLocal(r) + r.height),
        hasText: txt.length > 0,
        text: txt.slice(0, 30).replace(/\n/g, "|"),
        cls: (el.getAttribute("class") || "").slice(0, 30)
      });
    });
    rows.sort((a, b) => b.bottom - a.bottom);

    // gerçek içeriğin bittiği yer = metni olan en alt öğe
    const contentEnd = Math.max(...rows.filter((r) => r.hasText).map((r) => r.bottom), 0);

    return {
      scrollHeight: sc.scrollHeight,
      clientHeight: sc.clientHeight,
      contentEnd: Math.round(contentEnd),
      blank: Math.round(sc.scrollHeight - contentEnd),
      deepest: rows.slice(0, 10)
    };
  });

  console.log("\n=== SCROLL KONTEYNER ===");
  console.log(JSON.stringify(report, null, 2).slice(0, 2200));
});
