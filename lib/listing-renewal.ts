import { validateListingTitle } from "./listing-title";
import type { Listing } from "./types";
import { getFormSchema, resolveFormKey, type CategoryNode } from "./category-tree";
import { listingCategoryTrail } from "./mobile-catalog";
import { listingPhotos } from "./mobile-listing";
import { LIMITS } from "./validation";

export function listingRenewalProblem(listing: Listing, tree: CategoryNode[]) {
  const titleCheck = validateListingTitle(listing.title);
  if (titleCheck.error) return titleCheck.error;
  if (listing.description.trim().length < LIMITS.description.min) return "Açıklamayı tamamla.";
  if (!listing.provinceId || !listing.districtId) return "İl ve ilçe seçimini tamamla.";
  const photos = listingPhotos(listing);
  if (!photos.length || photos.length > 5) return "Kapak dahil 1–5 fotoğraf seç.";
  const trail = listingCategoryTrail(tree, listing);
  if (!trail.length) return "İlanın kategorisini kontrol et.";
  const schema = getFormSchema(resolveFormKey(trail));
  if (!Number.isFinite(listing.price) || listing.price < 0 || listing.price > LIMITS.price.max || schema?.fields.some(f => f.key === "price" && f.required) && listing.price <= 0) return "Geçerli bir fiyat gir.";
  const missing = schema?.fields.find(f => f.required && !["title", "description", "price"].includes(f.key) && (listing.attributes?.[f.key] === undefined || listing.attributes[f.key] === "" || Array.isArray(listing.attributes[f.key]) && !(listing.attributes[f.key] as unknown[]).length));
  if (missing) return `${missing.label} alanını tamamla.`;
  if (listing.partnershipMode !== "none" && (!Number.isFinite(listing.commissionValue) || listing.commissionValue <= 0 || listing.commissionType === "rate" && listing.commissionValue > 90)) return "Komisyon koşullarını düzelt.";
  return null;
}
