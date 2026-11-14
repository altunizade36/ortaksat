import { filterRangeError } from "./filter-numbers";
import { parseListingMoney } from "./listing-numbers";
import type { Listing } from "@/lib/types";
import type { LocationValue } from "@/components/location-selector";
import { matchesLocationFilter } from "@/lib/locations";
import { parseTrPrice } from "@/lib/validation";
import { searchKey } from "@/lib/locale";

export type MobileFilters = {
  currency?: "TRY" | "USD" | "EUR"; excludeOwner?: string;
  min: string; max: string; loc: LocationValue; attrs: Record<string, string | string[]>;
  ranges: Record<string, { min: string; max: string }>; texts: Record<string, string>;
  open: boolean; photos: boolean; urgent: boolean; warranty: boolean; owner: boolean; exchange: boolean;
  /** Ortak komisyonu alt sınırı: tutar (ilan para biriminde) ve/veya oran (%). Boş = sınır yok. Sunucu aynı adları okur. */
  minCommission?: number; minRate?: number;
  /** Yalnız bu andan SONRA yayınlanan ilanlar (ISO tarih) — "bugün / bu hafta / bu ay en çok kazandıran" süzgeci. */
  createdAfter?: string;
};
export const emptyMobileFilters = (): MobileFilters => ({ min: "", max: "", loc: {}, attrs: {}, ranges: {}, texts: {}, open: false, photos: false, urgent: false, warranty: false, owner: false, exchange: false });
/** Reset user criteria while preserving constraints supplied by the containing flow. */
export function clearMobileFilters(current: MobileFilters, lockOpen = false): MobileFilters {
  return { ...emptyMobileFilters(), currency: current.currency, excludeOwner: current.excludeOwner, open: lockOpen };
}
export function mobileFilterCount(f: MobileFilters): number {
  return Number(!!f.currency) + Number(!!(f.min || f.max)) + Number(!!(f.loc.provinceId || f.loc.districtId))
    + [f.open, f.photos, f.urgent, f.warranty, f.owner, f.exchange].filter(Boolean).length
    + Number(!!f.minCommission) + Number(!!f.minRate)
    + Object.values(f.attrs).filter(v => Array.isArray(v) ? v.length > 0 : !!v).length
    + Object.values(f.ranges).filter(v => v.min.trim() || v.max.trim()).length
    + Object.values(f.texts).filter(v => v.trim()).length;
}
const aliases: Record<string, string[]> = { km: ["km", "mileage"], gear: ["gear", "transmission"], warranty: ["warranty", "guarantee"], from: ["from", "sellerType", "fromOwner"], swap: ["swap", "exchange", "trade"] };
export function listingAttribute(l: Listing, key: string) { return (aliases[key] ?? [key]).map(k => l.attributes?.[k]).find(v => v !== undefined && v !== null && v !== ""); }
const yes = (v: unknown) => v === true || ["true", "evet", "var", "garantili", "takasli", "sahibinden"].includes(searchKey(String(v)));
export function mobileFilterError(f: MobileFilters): string | null {
  const priceError = filterRangeError(f.min, f.max);
  if (priceError) return priceError;
  for (const range of Object.values(f.ranges)) {
    const error = filterRangeError(range.min, range.max, "değer");
    if (error) return error;
  }
  return null;
}
export function filterMobileListings(items: Listing[], f: MobileFilters, query = "", now = new Date().toISOString()): Listing[] {
  return items.filter(l => {
    if (l.status !== "active" || f.currency && (l.currency || "TRY") !== f.currency || f.excludeOwner && l.ownerId === f.excludeOwner) return false;
    if (query && !searchKey([l.title, l.description, l.category, l.location, ...(l.tags ?? [])].join(" ")).includes(searchKey(query))) return false;
    if ((f.min.trim() && l.price < parseListingMoney(f.min)) || (f.max.trim() && l.price > parseListingMoney(f.max))) return false;
    if (!matchesLocationFilter(l, f.loc.provinceId, f.loc.districtId)) return false;
    // Komisyon alt sınırı — sunucudaki (mobile_catalogue_page) hesapla aynı: oranlı ilanda fiyat × oran, sabitte tutarın kendisi.
    if (f.minCommission && (l.commissionType === "rate" ? Math.round(l.price * l.commissionValue / 100) : l.commissionValue) < f.minCommission) return false;
    if (f.createdAfter && (l.createdAt || "") < f.createdAfter) return false;
    if (f.minRate && (l.commissionType === "rate" ? l.commissionValue : l.price > 0 ? l.commissionValue / l.price * 100 : 0) < f.minRate) return false;
    if ((f.open && (l.partnershipMode === "none" || l.partnershipMode === "invite")) || (f.photos && !(l.imageUrl || l.image || l.adAssets?.some(Boolean))) || (f.urgent && !(String(l.attributes?._urgentUntil ?? "") > now))) return false;
    if ((f.warranty && !yes(listingAttribute(l, "warranty"))) || (f.owner && !yes(listingAttribute(l, "from"))) || (f.exchange && !yes(listingAttribute(l, "swap")))) return false;
    if (!Object.entries(f.ranges).every(([key, range]) => {
      if (!range.min.trim() && !range.max.trim()) return true;
      const raw = listingAttribute(l, key);
      if (raw == null || raw === "" || !/\d/.test(String(raw))) return false;
      const n = typeof raw === "number" ? raw : parseTrPrice(String(raw));
      return Number.isFinite(n) && (!range.min.trim() || n >= parseListingMoney(range.min)) && (!range.max.trim() || n <= parseListingMoney(range.max));
    })) return false;
    if (!Object.entries(f.texts).every(([key, value]) => !value.trim() || searchKey(String(listingAttribute(l, key) ?? "")).includes(searchKey(value.trim())))) return false;
    return Object.entries(f.attrs).every(([key, value]) => {
      if (!value || Array.isArray(value) && !value.length) return true;
      const raw = listingAttribute(l, key);
      if (raw == null) return false;
      if (value === "true") return yes(raw);
      if (value === "false") return raw === false || ["false", "hayir", "yok"].includes(searchKey(String(raw)));
      const actual = (Array.isArray(raw) ? raw : [raw]).map(v => searchKey(String(v)));
      return (Array.isArray(value) ? value : [value]).every(v => actual.includes(searchKey(v)));
    });
  });
}
