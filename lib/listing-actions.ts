import type { Listing, PartnershipStatus } from "./types";

type JoinListing = Pick<Listing, "status" | "stockCount" | "attributes" | "partnershipMode" | "demo">;
export type ListingJoinAction = { kind: "apply" | "view" | "disabled"; label: string; reason?: string };

/** The caller supplies an invite code only after validating it for this listing. */
export function listingFlowPaths(id: string, validInviteCode?: string) {
  const encodedId = encodeURIComponent(id);
  const code = validInviteCode ? encodeURIComponent(validInviteCode) : "";
  return {
    listing: `/listing/${encodedId}${code ? `?ortak-davet=${code}` : ""}`,
    request: `/partnership-request/${encodedId}${code ? `?invite=${code}` : ""}`,
  };
}

/** Presentation rules; the server remains responsible for authorizing every mutation. */
export function listingJoinAction({ listing, status, isOwner = false, hasInvite = false, sellerBlocked = false }: {
  listing: JoinListing; status?: PartnershipStatus; isOwner?: boolean; hasInvite?: boolean; sellerBlocked?: boolean;
}): ListingJoinAction {
  const disabled = (label: string, reason: string): ListingJoinAction => ({ kind: "disabled", label, reason });
  if (isOwner) return disabled("İlan sahibi", "Kendi ilanına ortaklık başvurusu gönderemezsin.");
  if (listing.demo) return disabled("Örnek ilan", "Örnek ilanlar işlem yapmak için kullanılamaz.");
  // Existing records remain accessible even if the listing is subsequently closed.
  if (status === "active") return { kind: "view", label: "Ortaklığım" };
  if (status === "pending") return { kind: "view", label: "Talebim" };
  if (sellerBlocked) return disabled("İşlem kapalı", "Engellediğin kullanıcıya ortaklık başvurusu gönderemezsin.");
  if (status === "blocked") return disabled("Ortaklık kapalı", "Bu ilandaki ortaklığın kapatılmış. Yeni başvuru gönderilemiyor.");
  if (listing.status !== "active") return disabled("İlan kapalı", "Bu ilan şu anda yeni ortaklık başvurusu kabul etmiyor.");
  if (listing.attributes?._formKey !== "arayan" && listing.stockCount <= 0) return disabled("Tükendi", "Stokta bulunmayan ürüne yeni ortaklık başvurusu gönderilemiyor.");
  if (listing.partnershipMode === "none") return disabled("Ortaklığa kapalı", "Bu ilan ortak satışa açık değil.");
  if (listing.partnershipMode === "invite" && !hasInvite) return disabled("Davet gerekli", "Bu ilana yalnızca satıcının paylaştığı geçerli davet bağlantısıyla başvurabilirsin.");
  return { kind: "apply", label: "Ortak Ol" };
}

/** Listings accepting public applications, including seller approval but excluding invitation-only offers. */
export function isPublicPartnershipListing(listing: JoinListing): boolean {
  return listingJoinAction({ listing }).kind === "apply";
}
