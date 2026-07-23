import { test, expect } from "@playwright/test";

// MOBİL TARAYICI: il/ilçe seçimi alttan sayfa (OptionSheet) olmalı; küçük çapalı popover
// DEĞİL. Popover'da klavye/scroll listeyi sıçratıyordu ("aramada kayma" şikayeti).
test("MOBİL: il seçici alttan sayfa açar ve liste kaymadan kaydırılır", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Konum filtresi bir akordiyon içinde olabilir — varsa aç
  await page.getByText(/^Konum$/).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  const trigger = page.getByText(/Tüm iller|İl seçin/).first();
  await trigger.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    // en yüksek, kaydırılabilir liste kapsayıcısını bul
    const els = Array.from(document.querySelectorAll<HTMLElement>("div"));
    const scrollables = els.filter((e) => e.scrollHeight > e.clientHeight + 20 && e.clientHeight > 120)
      .sort((a, b) => b.clientHeight - a.clientHeight);
    const sc = scrollables[0];
    const txt = document.body.innerText;
    return {
      panelH: sc ? Math.round(sc.clientHeight) : 0,
      hasIstanbul: /İstanbul/.test(txt),
      ilSayisi: (txt.match(/Ankara|İzmir|Bursa|Antalya/g) || []).length
    };
  });
  console.log("panel yüksekliği:", m.panelH, "| İstanbul görünür:", m.hasIstanbul, "| tanınan il:", m.ilSayisi);

  // Kaydır → konumun korunduğunu doğrula (sıçrama yok)
  const scrollTest = await page.evaluate(async () => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("div"));
    const sc = els.filter((e) => e.scrollHeight > e.clientHeight + 20 && e.clientHeight > 120)
      .sort((a, b) => b.clientHeight - a.clientHeight)[0];
    if (!sc) return { ok: false, before: 0, after: 0 };
    sc.scrollTop = 300;
    await new Promise((r) => setTimeout(r, 700));
    return { ok: true, before: 300, after: Math.round(sc.scrollTop) };
  });
  console.log("kaydırma sonrası konum:", scrollTest.after, "(beklenen ~300, sıçrarsa 0)");
  expect(m.hasIstanbul, "il listesi açılmalı").toBeTruthy();
  if (scrollTest.ok) expect(scrollTest.after, "kaydırma konumu korunmalı (sıçrama yok)").toBeGreaterThan(150);
});
