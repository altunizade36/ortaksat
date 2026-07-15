import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const OUT = "e2e-artifacts/account-look";
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

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

async function seed() {
  const email = uniqueEmail("acc");
  const uid = await createConfirmedUser(email, PW, "Zeynep Kullanıcı");
  // Bir ilan (satıcı verisi olsun) + profil biraz zenginleşsin
  await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${uid}', 'Örnek İlan Hesap', 'e2e-acc-' || substr(md5(random()::text),1,8),
            'İstanbul', 'temiz', 'Kulaklık', 1200, 'rate', 15, 'active', 3, false, 'open') returning id`);
  await runSql(`update profiles set bio='Elektronik meraklısı, güvenilir satıcı.', phone='05551112233' where id='${uid}'`).catch(() => {});
  return { email, uid };
}

async function shoot(page: Page, tag: string, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true }).catch(() => {});
}

test("HESAP görünüm (masaüstü)", async ({ browser }) => {
  test.setTimeout(200_000);
  const { email } = await seed();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1500 } });
  const page = await ctx.newPage();
  await login(page, email);
  await shoot(page, "d-profile", "/profile");
  await shoot(page, "d-profile-edit", "/profile-edit");
  await ctx.close();
});

test("HESAP görünüm (mobil)", async ({ browser }) => {
  test.setTimeout(200_000);
  const { email } = await seed();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await login(page, email);
  await shoot(page, "m-profile", "/profile");
  await ctx.close();
});
