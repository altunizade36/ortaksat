import { test, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
const VW = 390;

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().click();
  await page.waitForTimeout(5000);
}

/** Ana scroll konteynerini ölç: şişkin (metinsiz ama çok uzun) sarmalayıcı var mı? */
async function measure(page: Page) {
  return page.evaluate((vw) => {
    const divs = Array.from(document.querySelectorAll<HTMLElement>("div"));
    const scrollables = divs.filter((e) => {
      const st = getComputedStyle(e);
      return (st.overflowY === "auto" || st.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 20;
    }).sort((a, b) => b.scrollHeight - a.scrollHeight);
    const sc = scrollables[0];
    if (!sc) return { err: "no-scroll" as const };
    const scRect = sc.getBoundingClientRect();

    // ŞİŞKİN sarmalayıcı: yüksekliği çok büyük ama doğrudan içeriğinin kapladığı yer küçük
    const bloated: Array<{ h: number; contentH: number; text: string }> = [];
    sc.querySelectorAll<HTMLElement>("div").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 500) return;
      // çocuklarının toplam kapladığı dikey alan
      const kids = Array.from(el.children) as HTMLElement[];
      if (!kids.length) return;
      const tops = kids.map((k) => k.getBoundingClientRect().top);
      const bots = kids.map((k) => k.getBoundingClientRect().bottom);
      const contentH = Math.max(...bots) - Math.min(...tops);
      if (r.height - contentH > 300) {
        bloated.push({ h: Math.round(r.height), contentH: Math.round(contentH), text: (el.innerText || "").trim().slice(0, 32).replace(/\n/g, "|") });
      }
    });

    // yatay taşma
    let overflowX = 0;
    sc.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > vw + 1) overflowX = Math.max(overflowX, Math.round(r.right - vw));
    });

    const hasMulti = /Donanım & Özellikler/i.test(document.body.innerText);
    const inForm = /Yeni ilan oluştur/i.test(document.body.innerText) && /İlan başlığı/i.test(document.body.innerText);
    return { scrollHeight: sc.scrollHeight, bloated: bloated.slice(0, 5), overflowX, scH: Math.round(scRect.height), hasMulti, inForm };
  }, VW);
}

// Farklı şemaları kapsayan kategoriler (araç/emlak/elektronik/moda/hizmet/iş/eğitim...)
const CATS = ["otomobil", "konut", "cep telefonu", "bilgisayar", "mobilya", "kadın giyim", "iş makinesi", "motosiklet", "arsa", "iş yeri", "hizmet", "özel ders", "iş ilanı", "bebek", "spor", "kitap", "hayvan", "yedek parça"];

test("TÜM KATEGORİLER: ilan verme formu şişme/taşma taraması (mobil)", async ({ page }) => {
  // 18 kategori × (sayfa yükleme + arama + form render) — varsayılan 90sn yetmiyor.
  // Kategori şemaları zenginleştikçe (Emlak/Vasıta tamamlamaları) her adım biraz uzadı;
  // ölçümler YEŞİL olmasına rağmen test süre bütçesinden düşüyordu.
  test.setTimeout(300_000);
  await page.setViewportSize({ width: VW, height: 844 });
  const email = uniqueEmail("allcat");
  await createConfirmedUser(email, PW, "E2E AllCat");
  await login(page, email);

  const bad: string[] = [];
  for (const cat of CATS) {
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const search = page.getByPlaceholder(/ne satıyorsun/i).first();
    const ok = await search.fill(cat).then(() => true).catch(() => false);
    if (!ok) { console.log(`?? ${cat}: arama kutusu yok`); continue; }
    await page.waitForTimeout(1300);
    // ilk öneriye tıkla
    const sug = page.locator("text=/›/").first();
    const clicked = await sug.click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!clicked) { console.log(`?? ${cat}: öneri bulunamadı/tıklanamadı`); continue; }
    await page.waitForTimeout(2600);

    const m = await measure(page);
    if ("err" in m) { console.log(`?? ${cat}: ${m.err}`); continue; }
    const flag = m.bloated.length > 0 || m.overflowX > 1;
    const line = `${flag ? "!!" : "ok"} ${cat.padEnd(14)} form=${m.inForm ? "E" : "H"} donanımBölümü=${m.hasMulti ? "VAR" : "yok"} h=${String(m.scrollHeight).padStart(5)} taşma=${m.overflowX} şişkin=${m.bloated.length}`;
    console.log(line);
    m.bloated.forEach((b) => console.log(`      ŞİŞKİN: h=${b.h} içerik=${b.contentH} "${b.text}"`));
    if (flag) {
      bad.push(cat);
      await page.screenshot({ path: `e2e-artifacts/cat-${cat.replace(/\s/g, "_")}.png` });
    }
  }
  console.log("\n=== SORUNLU KATEGORİLER: " + (bad.length ? bad.join(", ") : "YOK") + " ===");
});
