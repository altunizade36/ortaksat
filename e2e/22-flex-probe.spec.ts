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

test("FLEX PROBE: 'İlan etiketleri' sarmalayıcısı neden 1406px?", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = uniqueEmail("flexp");
  await createConfirmedUser(email, PW, "E2E Flex");
  await login(page, email);
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByPlaceholder(/ne satıyorsun/i).first().fill("otomobil");
  await page.waitForTimeout(1500);
  await page.getByText(/Otomobil/i).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const out = await page.evaluate(() => {
    const pick = (el: HTMLElement) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        h: Math.round(r.height), w: Math.round(r.width),
        display: s.display, flexDirection: s.flexDirection, flexWrap: s.flexWrap,
        alignItems: s.alignItems, alignContent: s.alignContent, alignSelf: s.alignSelf,
        flexGrow: s.flexGrow, flexShrink: s.flexShrink, flexBasis: s.flexBasis,
        height: s.height, minHeight: s.minHeight,
        text: (el.innerText || "").trim().slice(0, 28).replace(/\n/g, "|")
      };
    };
    // "İlan etiketleri" etiketini taşıyan alanın sarmalayıcısını bul
    const all = Array.from(document.querySelectorAll<HTMLElement>("div"));
    const target = all.find((e) => {
      const r = e.getBoundingClientRect();
      return r.height > 1000 && (e.innerText || "").trim().startsWith("İlan etiketleri");
    });
    if (!target) return { err: "hedef bulunamadı" };
    const parent = target.parentElement as HTMLElement;
    const grandparent = parent?.parentElement as HTMLElement;
    // kardeşleri (aynı flex satırında kim var?)
    const sibs = Array.from(parent?.children || []).map((c) => pick(c as HTMLElement));
    return {
      target: pick(target),
      parent: parent ? pick(parent) : null,
      grandparent: grandparent ? pick(grandparent) : null,
      siblings: sibs
    };
  });
  console.log("\n=== FLEX PROBE ===\n" + JSON.stringify(out, null, 2).slice(0, 3000));
});
