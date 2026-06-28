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

export function compactNumber(value: number) {
  return new Intl.NumberFormat(deviceLocale, {
    maximumFractionDigits: 1,
    notation: value >= 1000 ? "compact" : "standard"
  }).format(value);
}

export function shortDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";

  return new Intl.DateTimeFormat(deviceLocale, {
    day: "2-digit",
    month: "short"
  }).format(date);
}
