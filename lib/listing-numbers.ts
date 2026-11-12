/** Strict Turkish form numbers. Never discard signs, letters or malformed separators. */
export function parseListingMoney(raw: string | number): number {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : NaN;
  const value = raw.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:,\d{1,2})?$/.test(value)) return NaN;
  const number = Number(value.replace(/[. \u00a0\u202f]/g, "").replace(",", "."));
  return Number.isFinite(number) && number <= Number.MAX_SAFE_INTEGER / 100 ? number : NaN;
}

export function parseListingRate(raw: string): number {
  const value = raw.trim();
  return /^\d+(?:[.,]\d{1,2})?$/.test(value) ? Number(value.replace(",", ".")) : NaN;
}

/** Existing numeric values must reopen using the same decimal convention as the form. */
export function listingNumberInput(value: number): string {
  return String(value).replace(".", ",");
}

export const LISTING_MONEY_ERROR = "Geçerli bir tutar gir. Örnek: 1.500 veya 1.500,50. Eksi işareti ve harf kullanma.";

export function listingCommissionError(type: string, raw: string, maxPartners = ""): string {
  const value = type === "rate" ? parseListingRate(raw) : parseListingMoney(raw);
  if (!Number.isFinite(value) || value <= 0) return type === "rate"
    ? "Geçerli bir komisyon yüzdesi gir. Örnek: 5 veya 5,5."
    : LISTING_MONEY_ERROR;
  if (type === "rate" && value > 90) return "Yüzde komisyon 90 değerini aşamaz.";
  if (maxPartners && (!/^\d+$/.test(maxPartners) || !Number.isSafeInteger(Number(maxPartners)) || Number(maxPartners) < 1)) return "Ortak sayısı en az 1 olan bir tam sayı olmalı.";
  return "";
}
