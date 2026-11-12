import type { Lead, Listing, Partnership, Report, Review, Sale, User } from "@/lib/types";

export type TrustBreakdownItem = { label: string; value: number; tone: "positive" | "negative" | "neutral" };
export type RoleTrustScore = { score: number | null; label: string; breakdown: TrustBreakdownItem[] };
export type UserTrustScores = { overall: number | null; seller: RoleTrustScore; partner: RoleTrustScore };

/**
 * Compatibility boundary for old screens. Client-side profile completeness,
 * rejected applications and open complaints cannot establish trust or risk.
 * The authoritative role card is served by trust_v1_profile after activation.
 * Existing reports, reviews, sales and moderation flows are preserved.
 */
export function calculateUserTrustScores(_input: {
  leads: Lead[]; listings: Listing[]; partnerships: Partnership[]; reports: Report[];
  reviews: Review[]; sales: Sale[]; user: User;
}): UserTrustScores {
  const neutral = (): RoleTrustScore => ({ score: null, label: "Doğrulanmış karne bekleniyor", breakdown: [] });
  return { overall: null, seller: neutral(), partner: neutral() };
}
