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

export type CurrencyCode = "TRY" | "USD" | "EUR";
export const CURRENCIES: Array<{ code: CurrencyCode; symbol: string; label: string }> = [
  { code: "TRY", symbol: "₺", label: "Türk Lirası (₺)" },
  { code: "USD", symbol: "$", label: "Dolar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" }
];
const CURRENCY_SYMBOL: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };

/** İlanın para birimine göre fiyat gösterimi (₺/$/€ + deterministik binlik ayırıcı). */
export function moneyIn(value: number, currency?: string | null) {
  const sym = CURRENCY_SYMBOL[currency ?? "TRY"] ?? "₺";
  return `${sym}${groupThousands(value)}`;
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

/** TR cep telefonunu WhatsApp/wa.me için uluslararası haneye çevirir ("0555…" -> "90555…"). Geçersizse "". */
export function trPhoneIntl(phone: string | undefined | null): string {
  let d = (phone ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("90")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length === 10 && d.startsWith("5") ? "90" + d : "";
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

/**
 * Mesaj/sohbet zaman damgası: YEREL saat, saniye hassasiyeti "YYYY-MM-DD HH:MM:SS".
 * `iso` verilirse (sunucudan gelen UTC ISO) yerel saate çevrilir; verilmezse şu an.
 * Amaç: gerçek-zamanlı (sunucu) + yerel gönderim mesajlarının hep AYNI format ve
 * zaman diliminde olması → thread sıralaması (createdAt.localeCompare) tutarlı,
 * gösterilen saat cihaz saatiyle uyumlu, gün ayracı (Bugün) yerel güne göre doğru.
 */
export function msgStamp(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return (iso ?? "").slice(0, 19).replace("T", " ");
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Yerel bugünün tarihi "YYYY-MM-DD" (mesaj gün ayracı için; UTC değil). */
export function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
