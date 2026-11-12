/**
 * ÇEREZ / BENZERİ TEKNOLOJİ ONAYI (yalnız web).
 *
 * Dayanak: 6698 sayılı KVKK ve Kişisel Verileri Koruma Kurulu'nun "Çerez Uygulamaları Hakkında Rehber"i.
 * - ZORUNLU kayıtlar (oturum, güvenlik, dil, çerez tercihinin kendisi) izne bağlı değildir; her zaman çalışır.
 * - ANALİTİK (Vercel Web Analytics / Speed Insights) ve PAZARLAMA (Meta Pixel) yalnız AÇIK RIZA ile yüklenir.
 *   Varsayılan KAPALIDIR; ön-işaretli seçenek yoktur; "Reddet" ile "Kabul Et" aynı kolaylıktadır.
 * - Rıza dilediğin an "Çerez Tercihleri"nden geri alınabilir; geri alınınca betikler durdurulur (sayfa yenilenir)
 *   ve pazarlama çerezleri silinir.
 *
 * Betikleri gerçekten yükleyen kod app/+html.tsx içindeki satır-içi betiktir (window.__osConsent);
 * bu modül yalnız tercihi saklar ve o betiğe haber verir. Uygulamada (iOS/Android) çerez yoktur → hiçbir şey yapmaz.
 */
import { Platform } from "react-native";

/** +html.tsx içindeki satır-içi betikle AYNI olmalı. */
export const COOKIE_CONSENT_KEY = "ortaksat.cookieConsent.v1";
/** Çerez politikası esaslı değişirse artır: eski kayıt geçersiz sayılır ve tercih yeniden sorulur. */
export const COOKIE_CONSENT_VERSION = 1;

export type CookieConsent = {
  /** Politika sürümü. */
  v: number;
  analytics: boolean;
  marketing: boolean;
  /** Tercihin verildiği an (ISO). */
  at: string;
};

const OPEN_EVENT = "os-consent-open";
const CHANGE_EVENT = "os-consent-change";

const onWeb = () => Platform.OS === "web" && typeof window !== "undefined";

export function readCookieConsent(): CookieConsent | null {
  if (!onWeb()) return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent> | null;
    if (!parsed || parsed.v !== COOKIE_CONSENT_VERSION) return null;
    return { v: COOKIE_CONSENT_VERSION, analytics: parsed.analytics === true, marketing: parsed.marketing === true, at: String(parsed.at ?? "") };
  } catch {
    return null;
  }
}

/** Reklam ölçümünün bıraktığı birinci-taraf çerezleri (rıza geri alınınca silinir). */
const MARKETING_COOKIES = ["_fbp", "_fbc"];

function clearMarketingCookies(): void {
  try {
    const host = window.location.hostname;
    const domains = ["", host, "." + host, "." + host.replace(/^www\./, "")];
    for (const name of MARKETING_COOKIES) {
      for (const domain of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` + (domain ? `; domain=${domain}` : "");
      }
    }
  } catch { /* çerez silinemezse sessiz geç: betik zaten durduruluyor */ }
}

export function saveCookieConsent(choice: { analytics: boolean; marketing: boolean }): CookieConsent | null {
  if (!onWeb()) return null;
  const previous = readCookieConsent();
  const next: CookieConsent = { v: COOKIE_CONSENT_VERSION, analytics: choice.analytics, marketing: choice.marketing, at: new Date().toISOString() };
  try { window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(next)); } catch { /* özel sekme: tercih bu oturumla sınırlı kalır */ }

  const withdrewAnalytics = previous?.analytics === true && !next.analytics;
  const withdrewMarketing = previous?.marketing === true && !next.marketing;
  if (withdrewMarketing) clearMarketingCookies();

  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next })); } catch { /* eski tarayıcı */ }

  if (withdrewAnalytics || withdrewMarketing) {
    // Yüklenmiş bir betik bellekten çıkarılamaz; rızanın geri alınması ancak sayfa yenilenince tam uygulanır.
    try { window.location.reload(); } catch { /* yenilenemezse sonraki ziyarette uygulanır */ }
    return next;
  }
  // Yeni verilen izinler için betikleri hemen yükle (yenileme gerekmez).
  try { (window as unknown as { __osConsent?: (c: CookieConsent) => void }).__osConsent?.(next); } catch { /* sessiz */ }
  return next;
}

/** Alt bilgideki "Çerez Tercihleri" bağlantısı bunu çağırır. */
export function openCookiePreferences(): void {
  if (!onWeb()) return;
  try { window.dispatchEvent(new Event(OPEN_EVENT)); } catch { /* sessiz */ }
}

export function onOpenCookiePreferences(listener: () => void): () => void {
  if (!onWeb()) return () => {};
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
