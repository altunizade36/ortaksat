import { test, expect } from "@playwright/test";

// İlan verme — RENDER/HİDRASYON SMOKE'u.
// NOT: Eski 6-adım / "ne satıyorsun" arama akışı İKİ kez elden geçti (kategori
// arama → kademeli dropdown; sihirbaz → tek-sayfa iki-kolon). Eski uçtan-uca
// publish E2E'leri (Devam adımları + data-openlist seçicileri) o yüzden bayat.
// Bu smoke, tek-sayfa create ekranının ÇÖKMEDEN + hidrasyon hatası olmadan render
// olduğunu doğrular — İlan Gücü metresi diriltme + ~160 satır ölü kod temizliği +
// "İlanı Yayınla" buton refaktörü sonrası kritik regresyon kapısı.
// (Tam publish akışı için dropdown-tabanlı yeni E2E ayrı bir iş olarak yazılacak.)
test("ilan verme: tek-sayfa create ekranı çökmeden/hidrasyon hatasız render olur", async ({ page }) => {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
  page.on("pageerror", (e) => errs.push("PAGEERR: " + String(e).slice(0, 140)));

  await page.goto("https://ortaksat.com/create", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const body = await page.locator("body").innerText();

  // 1) Error-boundary çökmesi olmamalı
  const crashed = /bir şeyler ters gitti|Bir şeyler yanlış|Something went wrong/i.test(body);
  expect(crashed, "create ekranı error-boundary'ye düşmemeli").toBeFalsy();

  // 2) Yapısal render (tek-sayfa: sağ 'İlan Detayları' + sol 'Ürün Fotoğrafları' + kategori/intent)
  console.log("  yapısal:", ["İlan Detayları", "Ürün Fotoğrafları"].filter((t) => body.includes(t)).join(" / "));
  expect(body.includes("İlan Detayları"), "sağ kolon 'İlan Detayları' render olmalı").toBeTruthy();
  expect(body.includes("Ürün Fotoğrafları"), "sol kolon 'Ürün Fotoğrafları' render olmalı").toBeTruthy();
  expect(/Ne yapmak istersin|Kategori seç/i.test(body), "kategori/intent seçici görünmeli").toBeTruthy();

  // 3) Kritik React hidrasyon hataları olmamalı (bu ekranın geçmişi: #418/#310/#300 + chunk)
  console.log("  browser errors:", errs.length ? errs.slice(0, 3).join(" | ") : "yok");
  const critical = errs.filter((e) => /Minified React error #(418|310|300)|Requiring unknown module/i.test(e));
  expect(critical.length, `kritik React/chunk hatası olmamalı: ${critical.join(" | ")}`).toBe(0);
});
