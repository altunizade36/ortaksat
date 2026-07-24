import { getLocales } from "expo-localization";

const supportedLanguageTags = ["tr-TR", "en-US"] as const;
type SupportedLanguageTag = (typeof supportedLanguageTags)[number];

function pickDeviceLocale(): SupportedLanguageTag {
  const deviceLocale = getLocales()[0]?.languageTag;
  if (!deviceLocale) return "tr-TR";

  const normalized = deviceLocale.toLowerCase();
  if (normalized.startsWith("tr")) return "tr-TR";
  if (normalized.startsWith("en")) return "en-US";

  return "tr-TR";
}

export const deviceLocale = pickDeviceLocale();
export const deviceLanguage = deviceLocale.split("-")[0] as "tr" | "en";
export const defaultCurrency = "TRY";

// Uygulamanın SEÇİLİ dili (header toggle / oto-algılama). LanguageProvider bunu
// setActiveLanguage ile günceller; localize/shortDate/compactNumber bunu okur ki
// cihaz dili TR olsa bile toggle EN'e alınınca tarih/sayı/metin İngilizce olsun.
let activeLanguage: "tr" | "en" = deviceLanguage;
export function setActiveLanguage(lang: "tr" | "en") {
  activeLanguage = lang;
}

/**
 * Fixed "now" reference for deterministic relative-time rendering (e.g. the
 * "Yeni" badge). Using a literal date — not Date.now() — guarantees the static
 * export HTML and the client render agree, avoiding a hydration mismatch (#418).
 */
// BAYATLAMIŞTI: 2026-06-30 sabitti; gerçek ilanlar bu tarihten SONRA (2026-07+) oluşturulunca
// age negatif → hiçbiri "yeni" sayılmıyor, kartta "0 ortak" çıkıyor + "2 gün önce" tarihleri
// bozuluyordu. Güncel tarihe alındı (literal → SSG/istemci uyumlu, #418 yok). Periyodik güncellenir.
export const REFERENCE_NOW = Date.parse("2026-07-24T00:00:00Z");

export function localize(tr: string, en: string) {
  return activeLanguage === "en" ? en : tr;
}

export function lower(value: string) {
  return value.toLocaleLowerCase(deviceLocale);
}

export function searchKey(value: string) {
  return lower(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function upper(value: string) {
  return value.toLocaleUpperCase(deviceLocale);
}

// Deterministic (no Intl) so server-rendered cards match the client (no #418).
export function compactNumber(value: number) {
  const n = Math.round(value);
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    const en = activeLanguage === "en";
    const text = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(".", en ? "." : ",");
    return `${text} ${en ? "K" : "B"}`;
  }
  return String(n);
}

const SHORT_MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const SHORT_MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";
  const months = activeLanguage === "en" ? SHORT_MONTHS_EN : SHORT_MONTHS_TR;
  return `${String(date.getDate()).padStart(2, "0")} ${months[date.getMonth()]}`;
}
