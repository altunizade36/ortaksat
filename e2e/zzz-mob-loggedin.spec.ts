import { test, expect, devices } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

test.use({ ...devices["iPhone 13"] });
const PW = "GucluSifre123!";

test("mobil GİRİŞLİ: header erişimi + sayfa taşma/hata taraması", async ({ page }) => {
  test.setTimeout(240_000);
  const email = uniqueEmail("mobd");
  await createConfirmedUser(email, PW, "Mobil Test");
  await resetAuthRateLimits();
  await page.goto("https://ortaksat.com/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);

  await page.goto("https://ortaksat.com/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Header'da hesap özelliklerine erişim var mı? (ikon/label/aria)
  const access = await page.evaluate(() => {
    const txt = document.body.innerText;
    const labels = Array.from(document.querySelectorAll("[aria-label]")).map((e) => e.getAttribute("aria-label") || "");
    const all = (txt + " " + labels.join(" ")).toLowerCase();
    return {
      hesabim: /hesab|profil/i.test(all),
      mesaj: /mesaj|message/i.test(all),
      bildirim: /bildirim|notification/i.test(all),
      favori: /favori/i.test(all)
    };
  });
  console.log("[mobil header erişim]", JSON.stringify(access));
  await page.screenshot({ path: "e2e-artifacts/mob-home-header.png" });

  // Girişli sayfa taraması
  const PAGES = ["/(tabs)/menu", "/profile", "/messages", "/notifications-tab", "/favorites", "/(tabs)/seller", "/(tabs)/partner", "/earnings", "/profile-edit"];
  const rows: string[] = [];
  for (const path of PAGES) {
    const errs: string[] = [];
    const onErr = (m: any) => { if (m.type && m.type() === "error") errs.push(m.text().slice(0, 70)); };
    page.on("console", onErr);
    await page.goto(`https://ortaksat.com${path}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1800);
    const m = await page.evaluate(() => {
      const w = window.innerWidth;
      const overflow = document.documentElement.scrollWidth - w;
      const t = document.body.innerText;
      return { overflow, len: t.length, crash: /ters gitti|Something went wrong/i.test(t) };
    });
    rows.push(`${path.padEnd(20)} ${m.overflow > 2 ? "⚠TAŞMA " + m.overflow + "px" : "ok"}${m.crash ? " ÇÖKTÜ" : ""}${m.len < 200 ? " BOŞ" : ""}${errs.length ? " ERR:" + errs[0] : ""}`);
    page.off("console", onErr);
  }
  console.log("\n[girişli mobil sayfalar]\n" + rows.join("\n"));
});
