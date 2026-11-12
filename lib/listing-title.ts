import { repairTurkishText } from "./text";
/** Listing titles: one policy for forms, imports and persistence. Never truncate input. */
export const LISTING_TITLE_LIMITS = { min: 10, max: 70 } as const;
export const LISTING_TITLE_HELP = "10–70 karakter. Ürün, marka/model ve önemli özelliğini yazın. Emoji, ok, yıldız ve süsleme kullanmayın.";
const decoration = /[\uFE00-\uFE0F\u20D0-\u20FF]/u;
const allowed = /^[\p{L}\p{M}0-9²³ .,\u0027’"()/:+&%\-]+$/u;
export function normalizeListingTitle(value: string): string {
  return String(value ?? "").normalize("NFC").replace(/\u00a0/g, " ").replace(/ +/g, " ").trim();
}
export function listingTitleLength(value: string): number { return Array.from(normalizeListingTitle(value)).length; }
export function validateListingTitle(value: string): { ok: boolean; title: string; error: string | null } {
  const raw = String(value ?? "").normalize("NFC");
  const title = normalizeListingTitle(raw);
  let error: string | null = null;
  if (raw && (decoration.test(raw) || !allowed.test(raw.replace(/\u00a0/g, " "))))
    error = "Başlıkta emoji, ok, yıldız, süsleme veya görünmez karakter kullanmayın. Harf, rakam ve anlamlı noktalama kullanın.";
  else if (/[.,'’"()/:+&%\-]{3,}/u.test(title))
    error = "Noktalama işaretlerini art arda kullanmayın. Başlığı sade ve okunaklı yazın.";
  else if (listingTitleLength(title) < LISTING_TITLE_LIMITS.min)
    error = `Başlık en az ${LISTING_TITLE_LIMITS.min} karakter olmalı.`;
  else if (listingTitleLength(title) > LISTING_TITLE_LIMITS.max)
    error = `Başlık en fazla ${LISTING_TITLE_LIMITS.max} karakter olabilir. Lütfen kısaltın.`;
  else if (!/[\p{L}0-9]/u.test(title))
    error = "Başlıkta ürününüzü tanımlayan harf veya rakam bulunmalı.";
  return { ok: !error, title, error };
}
/** Presentation only: preserve stored originals so the editor can explain invalid legacy input. */
export function displayListingTitle(value: string | null | undefined, fallback = "İlan"): string {
  const cleaned = normalizeListingTitle(repairTurkishText(value).replace(/[\uFE00-\uFE0F\u20D0-\u20FF]/gu, "").replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{M}0-9²³ .,\u0027’"()/:+&%\-]/gu, " ")
    .replace(/[.,'’"()/:+&%\-]{3,}/gu, " "));
  return cleaned || fallback;
}
