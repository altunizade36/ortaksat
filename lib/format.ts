import type { Listing } from "@/lib/types";
import { defaultCurrency, deviceLocale, localize } from "@/lib/locale";

const formatter = new Intl.NumberFormat(deviceLocale, {
  style: "currency",
  currency: defaultCurrency,
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0
});

// Deterministic thousands grouping with "." — identical on Node (static export)
// and the browser, so prices don't trigger a hydration mismatch (React #418).
function groupThousands(value: number) {
  const rounded = Math.round(Math.abs(Number.isFinite(value) ? value : 0));
  const digits = String(rounded);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ".";
    out += digits[i];
  }
  return (value < 0 ? "-" : "") + out;
}

export function money(value: number) {
  if (defaultCurrency === "TRY") {
    return `₺${groupThousands(value)}`;
  }
  const formatted = formatter.format(Number.isFinite(value) ? value : 0);
  return formatted;
}

export function commissionText(listing: Listing) {
  if (listing.commissionType === "rate") {
    return localize(`%${listing.commissionValue} komisyon`, `${listing.commissionValue}% commission`);
  }

  return localize(`${money(listing.commissionValue)} komisyon`, `${money(listing.commissionValue)} commission`);
}

export function commissionAmount(listing: Listing) {
  if (listing.commissionType === "rate") {
    return Math.round((listing.price * listing.commissionValue) / 100);
  }

  return listing.commissionValue;
}

export function shareUrl(listing: Listing, refCode: string) {
  return `https://ortaksat.com/i/${listing.slug}?ref=${refCode}`;
}

// Düz ürün paylaşımı: herkesin açabileceği ürün detay sayfası (referans formu değil).
export function productUrl(listing: Listing) {
  return `https://ortaksat.com/listing/${listing.id}`;
}

export function listingShareTemplates(listing: Listing, url?: string) {
  const link = url ?? `https://ortaksat.com/listing/${listing.id}`;
  const commission = commissionText(listing);
  const firstPitch = listing.salesPitch[0] ?? listing.description;

  return {
    instagram: listing.shareTemplates?.instagram || `${listing.title}\n${firstPitch}\nFiyat: ${money(listing.price)}\nOrtak satış linki: ${link}`,
    whatsapp: listing.shareTemplates?.whatsapp || `Merhaba, ${listing.title} ürünü için detayları göndereyim.\nFiyat: ${money(listing.price)}\n${firstPitch}\nLink: ${link}`,
    tiktok: listing.shareTemplates?.tiktok || `${listing.title} için kısa tanıtım: ${firstPitch} ${commission}. Detay linki profilde: ${link}`
  };
}
