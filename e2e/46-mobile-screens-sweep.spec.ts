import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);
}

/** Ekran denetimi: yatay taşma, çakışan metin, TEPKİSİZ (disabled) buton. */
async function audit(page: Page, name: string) {
  const d = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const inHScroll = (el: HTMLElement) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (s.overflowX === "auto" || s.overflowX === "scroll") return true;
        p = p.parentElement;
      }
      return false;
    };
    // 1) gerçek sayfa yatay taşması
    const pageOverflow = document.documentElement.scrollWidth - vw;
    // 2) yatay-scroll dışında viewport'u aşan öğeler
    const over: string[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= vw + 1) return;
      if (inHScroll(el)) return;
      const t = (el.innerText || "").trim().slice(0, 24).replace(/\n/g, "|");
      if (t) over.push(`+${Math.round(r.right - vw)}px "${t}"`);
    });
    // 3) TEPKİSİZ butonlar: pointer-events kapalı / opacity düşük (disabled görünümlü)
    const dead: string[] = [];
    document.querySelectorAll<HTMLElement>('[role="button"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.top > vh || r.bottom < 0) return;
      const s = getComputedStyle(el);
      const t = (el.innerText || "").trim().slice(0, 22).replace(/\n/g, " ");
      if (!t) return;
      if (s.pointerEvents === "none" || (el as HTMLButtonElement).disabled) dead.push(`"${t}"`);
    });
    // 4) dokunma hedefi <44px olan butonlar (mobil erişilebilirlik)
    let small = 0;
    document.querySelectorAll<HTMLElement>('[role="button"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 36 && r.width > 0 && (el.innerText || "").trim()) small++;
    });
    return { pageOverflow, over: [...new Set(over)].slice(0, 5), dead: [...new Set(dead)].slice(0, 6), small };
  });
  const bad = d.pageOverflow > 1 || d.over.length || d.dead.length;
  console.log(`${bad ? "!!" : "ok"} [${name}] taşma=${d.pageOverflow} taşanÖğe=${d.over.length} tepkisizButon=${d.dead.length} küçükHedef=${d.small}`);
  d.over.forEach((o) => console.log("     TAŞAN: " + o));
  d.dead.forEach((o) => console.log("     TEPKİSİZ BUTON: " + o));
  return bad;
}

test("MOBİL EKRAN TARAMASI: satıcı, ortak, keşfet, mesaj, profil", async ({ page }) => {
  page.on("console", (m) => { if (m.type() === "error") console.log("  BROWSER-ERR:", m.text().slice(0, 110)); });
  const email = uniqueEmail("sweep");
  await createConfirmedUser(email, PW, "E2E Sweep");
  await login(page, email);

  const screens: Array<[string, string]> = [
    ["ana sayfa", "/"],
    ["keşfet", "/explore"],
    ["satıcı paneli", "/seller"],
    ["ortak paneli", "/partner"],
    ["mesajlar", "/messages"],
    ["favoriler", "/favorites"],
    ["profil", "/profile"],
    ["kazançlar", "/earnings"],
    ["bildirimler", "/notifications"]
  ];

  for (const [name, url] of screens) {
    await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(3500);
    await audit(page, name);
    // sayfanın altını da gör
    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll<HTMLElement>("div"));
      const sc = divs.filter((e) => { const s = getComputedStyle(e); return (s.overflowY === "auto" || s.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 20; }).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (sc) sc.scrollTop = sc.scrollHeight; else window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(900);
    await audit(page, `${name} (alt)`);
  }
});
