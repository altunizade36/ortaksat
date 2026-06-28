import type { Listing } from "@/lib/types";
import { defaultCurrency, deviceLocale, localize } from "@/lib/locale";

const formatter = new Intl.NumberFormat(deviceLocale, {
  style: "currency",
  currency: defaultCurrency,
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0
});

export function money(value: number) {
  const formatted = formatter.format(value);
  if (defaultCurrency === "TRY") {
    return formatted.replace("TRY", "₺").replace("TL", "₺").replace(/\s+/g, "");
  }
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

export function listingShareTemplates(listing: Listing, url?: string) {
  const link = url ?? `https://ortaksat.com/i/${listing.slug}`;
  const commission = commissionText(listing);
  const firstPitch = listing.salesPitch[0] ?? listing.description;

  return {
    instagram: listing.shareTemplates?.instagram || `${listing.title}\n${firstPitch}\nFiyat: ${money(listing.price)}\nOrtak satış linki: ${link}`,
    whatsapp: listing.shareTemplates?.whatsapp || `Merhaba, ${listing.title} ürünü için detayları göndereyim.\nFiyat: ${money(listing.price)}\n${firstPitch}\nLink: ${link}`,
    tiktok: listing.shareTemplates?.tiktok || `${listing.title} için kısa tanıtım: ${firstPitch} ${commission}. Detay linki profilde: ${link}`
  };
}
