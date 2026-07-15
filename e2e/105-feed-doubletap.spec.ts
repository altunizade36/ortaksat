import { test, expect, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/feed-doubletap";

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  const eb = page.getByText(/E-posta ile giriş yap/i).first();
  if (await eb.count().then((c) => c > 0).catch(() => false)) await eb.click();
  else await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(5500);
}

test("KEŞFET FEED: çift-dokun beğeni + kaydırma korunur (mobil)", async ({ browser }) => {
  test.setTimeout(180_000);
  const email = uniqueEmail("dtap");
  await createConfirmedUser(email, PW, "Cift Dokun");
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await login(page, email);

  // Feed'e gir
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const gorsel = page.getByText(/^Görsel$/).first();
  await gorsel.click({ timeout: 6000 });
  await page.waitForTimeout(3500);

  // Beğeni durumu ÖNCE
  const favBefore = await page.evaluate(() => document.body.innerText.includes("Favoride"));

  // Tap-katmanına ÇİFT DOKUN (testID ile kesin hedef, clickCount:2 gerçek çift-tık)
  const tapLayer = page.getByTestId("feed-tap-layer").first();
  await tapLayer.click({ clickCount: 2, delay: 60 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/1-cift-dokun.png` }).catch(() => {});

  const favAfter = await page.evaluate(() => document.body.innerText.includes("Favoride"));
  // DB'den de doğrula (etiket gecikebilir)
  const favRows = await runSql<Array<{ c: string }>>(`select count(*)::text c from favorites f join profiles p on p.id=f.user_id where p.full_name='Cift Dokun'`).catch(() => [{ c: "?" }]);
  console.log(`beğeni: etiket önce=${favBefore} → sonra=${favAfter} | DB favori=${favRows[0]?.c}`);
  expect(favAfter || Number(favRows[0]?.c) > 0, "çift-dokun beğeniyi eklemeli (Favoride/DB)").toBeTruthy();

  // KAYDIRMA hâlâ çalışıyor mu — bir sonraki öğeye geç
  const counterBefore = await page.evaluate(() => (document.body.innerText.match(/(\d+)\/(\d+)/) || [])[1] ?? "?");
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("div")) as HTMLElement[];
    const sv = all.find((el) => (getComputedStyle(el).overflowY === "scroll" || getComputedStyle(el).overflowY === "auto") && el.scrollHeight > el.clientHeight + 100);
    if (sv) sv.scrollTop += window.innerHeight;
  });
  await page.waitForTimeout(1500);
  const counterAfter = await page.evaluate(() => (document.body.innerText.match(/(\d+)\/(\d+)/) || [])[1] ?? "?");
  console.log(`kaydırma: sayaç ${counterBefore} → ${counterAfter}`);
  expect(counterAfter, "çift-dokun sonrası dikey kaydırma (paging) hâlâ çalışmalı").not.toBe(counterBefore);

  console.log("FEED ÇİFT-DOKUN + KAYDIRMA OK");
  await runSql(`delete from favorites where user_id in (select id from profiles where full_name='Cift Dokun')`).catch(() => {});
  await ctx.close();
});
