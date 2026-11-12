import { parseListingMoney } from "./listing-numbers";

/** Form bounds are optional; malformed values never become different amounts. */
export function filterRangeError(min: string, max: string, label = "fiyat"): string | null {
  const bounds = [min, max].map(v => v.trim());
  if (bounds.some(v => v && (!Number.isFinite(parseListingMoney(v)) || parseListingMoney(v) > 999_999_999_999))) return "Geçerli bir aralık gir. Örnek: 1.500 veya 1.500,50. Eksi işareti ve harf kullanma.";
  if (bounds.every(Boolean) && parseListingMoney(bounds[0]) > parseListingMoney(bounds[1])) return `Minimum ${label}, maksimum ${label === "fiyat" ? "fiyattan" : "değerden"} büyük olamaz.`;
  return null;
}

/** URL values use plain JS decimals; form inputs use Turkish decimals. */
export function serializePriceRange(min: string, max: string): string {
  if (filterRangeError(min, max)) return "";
  const bounds = [min, max].map(v => v.trim() ? String(parseListingMoney(v)) : "");
  return bounds.some(Boolean) ? bounds.join("-") : "";
}
