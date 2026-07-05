import { test, expect } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, runSql, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";

test("ADMIN: canlı kullanıcı aktivitesi (heartbeat + grafik)", async ({ page }) => {
  const email = uniqueEmail("admin");
  const uid = await createConfirmedUser(email, PW, "E2E Admin");
  // Rol-yükseltme trigger'ını yalnız test kurulumu için baypas et.
  await runSql(`set session_replication_role = replica; update profiles set role='admin' where id='${uid}'; set session_replication_role = default;`);
  await resetAuthRateLimits();

  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText("Giriş Yap", { exact: true }).last().click();
  await page.waitForTimeout(5000); // presence heartbeat

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const body = await page.locator("body").innerText();
  expect(body).toContain("Canlı Kullanıcı Aktivitesi");
  expect(body).toContain("Şu an aktif");
  expect(body).toContain("Son 7 gün");

  const live = await runSql<Array<{ n: number }>>(`select count(*) as n from profiles where last_seen_at > now() - interval '5 minutes';`);
  expect(Number(live[0].n), "presence heartbeat çalışmalı").toBeGreaterThan(0);
});
