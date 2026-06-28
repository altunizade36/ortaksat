import type { Lead, Listing, Partnership, Report, Review, Sale, User } from "@/lib/types";

export type TrustBreakdownItem = {
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
};

export type RoleTrustScore = {
  score: number;
  label: string;
  breakdown: TrustBreakdownItem[];
};

export type UserTrustScores = {
  overall: number;
  seller: RoleTrustScore;
  partner: RoleTrustScore;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function labelFor(score: number) {
  if (score >= 85) return "Çok güvenilir";
  if (score >= 70) return "Güvenilir";
  if (score >= 50) return "Gelişiyor";
  return "Riskli";
}

function positive(label: string, value: number): TrustBreakdownItem {
  return { label, value, tone: "positive" };
}

function negative(label: string, value: number): TrustBreakdownItem {
  return { label, value: -Math.abs(value), tone: "negative" };
}

function neutral(label: string, value: number): TrustBreakdownItem {
  return { label, value, tone: "neutral" };
}

function baseVerification(user: User) {
  return [
    user.verifiedPhone ? positive("Telefon doğrulama", 10) : neutral("Telefon bekliyor", 0),
    user.verifiedIdentity ? positive("Kimlik doğrulama", 20) : neutral("Kimlik bekliyor", 0),
    user.verifiedInstagram ? positive("Instagram doğrulama", 10) : neutral("Instagram bekliyor", 0)
  ];
}

function responseScore(user: User) {
  if (user.responseRate >= 90) return positive("Yüksek yanıt oranı", 10);
  if (user.responseRate >= 70) return positive("İyi yanıt oranı", 6);
  if (user.responseRate > 0) return positive("Yanıt oranı", 3);
  return neutral("Yanıt oranı yok", 0);
}

function reviewScore(reviews: Review[], type: "seller" | "partner" | "product") {
  const scoped = reviews.filter((review) => review.type === type || (type === "seller" && review.type === "product"));
  const avg = average(scoped.map((review) => review.rating));
  if (avg >= 4.7) return positive("Yüksek memnuniyet", 12);
  if (avg >= 4.2) return positive("İyi memnuniyet", 8);
  if (avg > 0) return positive("Yorum geçmişi", 4);
  return neutral("Yorum yok", 0);
}

export function calculateUserTrustScores(input: {
  leads: Lead[];
  listings: Listing[];
  partnerships: Partnership[];
  reports: Report[];
  reviews: Review[];
  sales: Sale[];
  user: User;
}): UserTrustScores {
  const { leads, listings, partnerships, reports, reviews, sales, user } = input;
  const userListingIds = new Set(listings.filter((listing) => listing.ownerId === user.id).map((listing) => listing.id));
  const userPartnershipIds = new Set(partnerships.filter((partnership) => partnership.partnerId === user.id).map((partnership) => partnership.id));
  const sellerSales = sales.filter((sale) => userListingIds.has(sale.listingId));
  const partnerSales = sales.filter((sale) => userPartnershipIds.has(sale.partnershipId));
  const partnerLeads = leads.filter((lead) => userPartnershipIds.has(lead.partnershipId));
  const reportsAboutUser = reports.filter((report) => report.reportedUserId === user.id && report.status !== "rejected");
  const sellerReviews = reviews.filter((review) => review.reviewedUserId === user.id || userListingIds.has(review.listingId));
  const partnerReviews = reviews.filter((review) => review.reviewedUserId === user.id && review.type === "partner");

  const disputedSellerSales = sellerSales.filter((sale) => sale.status === "disputed").length;
  const cancelledSellerSales = sellerSales.filter((sale) => sale.status === "cancelled").length;
  const rejectedApplications = partnerships.filter((partnership) => partnership.partnerId === user.id && partnership.status === "rejected").length;

  const sellerBreakdown = [
    ...baseVerification(user),
    responseScore(user),
    user.successfulSales > 20 ? positive("Başarılı satış geçmişi", 15) : user.successfulSales > 5 ? positive("Başarılı satış", 9) : user.successfulSales > 0 ? positive("İlk satışlar", 4) : neutral("Satış geçmişi yok", 0),
    reviewScore(sellerReviews, "seller"),
    sellerSales.some((sale) => sale.status === "paid") ? positive("Zamanında komisyon ödeme", 12) : sellerSales.some((sale) => sale.status === "seller_paid") ? positive("Ödeme bildirimi", 7) : neutral("Komisyon ödeme geçmişi yok", 0),
    disputedSellerSales > 0 ? negative("Anlaşmazlık / geç ödeme", disputedSellerSales * 8) : neutral("Anlaşmazlık yok", 0),
    cancelledSellerSales > 0 ? negative("İptal / yüksek iade", cancelledSellerSales * 6) : neutral("İade riski düşük", 0),
    reportsAboutUser.length > 0 ? negative("Şikayet kaydı", reportsAboutUser.length * 10) : neutral("Şikayet yok", 0)
  ];

  const convertedLeads = partnerLeads.filter((lead) => lead.status === "converted").length;
  const lostLeads = partnerLeads.filter((lead) => lead.status === "lost").length;
  const partnerBreakdown = [
    ...baseVerification(user),
    responseScore(user),
    convertedLeads >= 5 ? positive("Gerçek müşteri getiriyor", 15) : convertedLeads > 0 ? positive("Satışa dönen talep", 9) : partnerLeads.length > 0 ? positive("Talep getiriyor", 5) : neutral("Talep geçmişi yok", 0),
    partnerSales.length >= 5 ? positive("Başarılı ortak satış", 12) : partnerSales.length > 0 ? positive("Ortak satış geçmişi", 7) : neutral("Ortak satış yok", 0),
    reviewScore(partnerReviews, "partner"),
    lostLeads > convertedLeads && lostLeads >= 3 ? negative("Düşük talep kalitesi", 8) : neutral("Talep kalitesi normal", 0),
    reportsAboutUser.length > 0 ? negative("Spam / yanlış temsil şikayeti", reportsAboutUser.length * 10) : neutral("Şikayet yok", 0),
    rejectedApplications > 0 ? negative("Reddedilen başvuru", rejectedApplications * 4) : neutral("Başvuru sicili temiz", 0)
  ];

  const sellerScore = clamp(sellerBreakdown.reduce((sum, item) => sum + item.value, 35));
  const partnerScore = clamp(partnerBreakdown.reduce((sum, item) => sum + item.value, 35));
  const overall = clamp(Math.round((sellerScore + partnerScore) / 2));

  return {
    overall,
    seller: {
      score: sellerScore,
      label: labelFor(sellerScore),
      breakdown: sellerBreakdown
    },
    partner: {
      score: partnerScore,
      label: labelFor(partnerScore),
      breakdown: partnerBreakdown
    }
  };
}
