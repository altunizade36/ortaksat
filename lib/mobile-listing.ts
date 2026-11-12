import {effectiveCommissionAmount,tierRate,moneyIn} from "@/lib/format";
import type { Listing, Partnership } from "@/lib/types";

export const listingStatusLabels: Record<Listing["status"], string> = {
  active: "Yayında", draft: "Taslak", pending_review: "İncelemede", paused: "Yayından kaldırıldı",
  expired: "Süresi doldu", sold: "Satıldı", rejected: "Reddedildi", archived: "Arşivlendi",
};
type ListingMediaRef = Pick<Listing, "image" | "imageUrl" | "adAssets">;
const VIDEO_URL = /\.(mp4|mov|m4v|webm)(\?|#|$)/i;
/** Kapak + adAssets: fotoğraflar VE (varsa, sonda) tek ilan videosu. */
export const listingMedia = (listing: ListingMediaRef) =>
  [...new Set([listing.imageUrl || listing.image, ...(listing.adAssets ?? [])].filter((s): s is string => typeof s === "string").map(s => s.trim()).filter(Boolean))];
/** Yalnız FOTOĞRAFLAR (video hariç) — sayaçlar, küçük resimler ve kapak seçimi bunu kullanır. */
export const listingPhotos = (listing: ListingMediaRef) => listingMedia(listing).filter((uri) => !VIDEO_URL.test(uri));
export function maximumPartners(listing: Pick<Listing, "attributes">) {
  const value = Number(listing.attributes?._maxPartners);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
export function priceChange(saved: number | undefined, current: number) {
  if (!saved || saved <= 0 || !Number.isFinite(current) || current === saved) return null;
  const percent = Number((Math.abs(current - saved) / saved * 100).toPrecision(3));
  return { down: current < saved, percent };
}
export function attributeText(value: unknown) {
  return typeof value === "boolean" ? value ? "Evet" : "Hayır" : Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

export function potentialCommission(listing:Listing,partnership?:Partnership):number|null {
  const override=!!partnership?.commissionOverrideType&&typeof partnership.commissionOverrideValue==="number";
  const agreed=!!partnership?.agreedCommissionType&&typeof partnership.agreedCommissionValue==="number";
  const type=override?partnership!.commissionOverrideType:agreed?partnership!.agreedCommissionType:listing.commissionType;
  const value=override?partnership!.commissionOverrideValue!:agreed?partnership!.agreedCommissionValue!:listing.commissionValue;
  const rate=type==="rate"&&!override?tierRate(agreed?partnership?.agreedCommissionTiers:listing.commissionTiers,value,0):value;
  if(!Number.isFinite(rate)||rate<0||type==="rate"&&rate>90||!Number.isFinite(listing.price)||listing.price<=0)return null;
  return effectiveCommissionAmount(listing,partnership,0,listing.price,1);
}

/** Legacy data may contain invalid rates; never guess that a rate was intended as a money amount. */
export function listingCommissionDisplay(listing: Pick<Listing, "commissionType" | "commissionValue" | "currency">): string | null {
  const value = listing.commissionValue;
  if (!Number.isFinite(value) || value <= 0) return null;
  if (listing.commissionType === "rate") return value <= 90 ? `%${value}` : null;
  return listing.commissionType === "fixed" ? moneyIn(value, listing.currency) : null;
}
