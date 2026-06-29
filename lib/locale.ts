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

export function localize(tr: string, en: string) {
  return deviceLanguage === "en" ? en : tr;
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
    const text = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(".", ",");
    return `${text} B`;
  }
  return String(n);
}

const SHORT_MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function shortDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";
  return `${String(date.getDate()).padStart(2, "0")} ${SHORT_MONTHS_TR[date.getMonth()]}`;
}
