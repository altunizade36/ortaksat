import type { Page } from "@playwright/test";

/**
 * Onay diyaloğunu geçer.
 *
 * Eskiden web'de onaylar tarayıcının `window.confirm`'ü ile çıkıyordu ve testler
 * `page.on("dialog", d => d.accept())` ile geçiyordu. Artık markalı UYGULAMA-İÇİ
 * modal (components/alert-host.tsx) kullanılıyor → gerçek kullanıcı gibi BUTONA
 * basmak gerekir. Bu yardımcı, açıksa onay butonuna basar; yoksa sessizce geçer.
 */
export async function acceptConfirm(page: Page, timeout = 2500): Promise<boolean> {
  const btn = page.getByTestId("alert-confirm");
  try {
    await btn.waitFor({ state: "visible", timeout });
  } catch {
    return false; // onay istenmedi
  }
  await btn.click({ timeout: 4000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  return true;
}
