export type TrustRole = "seller" | "partner" | "buyer";
export const roleLabels: Record<TrustRole, string> = { seller: "Satıcı", partner: "Satış ortağı", buyer: "Alıcı" };
export const saleLabels = {
  partnership_active: "Ortaklık aktif", buyer_referred: "Alıcı yönlendirildi", negotiating: "Satış görüşülüyor",
  sale_reported: "Satış bildirildi", verification_pending: "Satış doğrulaması bekleniyor", sale_verified: "Satış taraflarca doğrulandı",
  not_sold: "Satış gerçekleşmedi", cancelled: "İptal edildi", disputed: "Anlaşmazlık var"
} as const;
export const commissionLabels = {
  not_earned: "Henüz hak edilmedi", under_review: "Hak ediş incelemede", earned: "Hak edildi", awaiting_payment: "Ödeme bekleniyor",
  seller_declared: "Satıcı ödediğini bildirdi", mutual_confirmed: "Taraflarca doğrulandı", disputed: "Ödeme konusunda itiraz var", void: "İptal veya geçersiz"
} as const;
export type TrustCapabilities = { enabled: boolean; phoneRequired: boolean; phoneVerificationAvailable: boolean; evidenceScanningAvailable: boolean; guestReferralsAvailable: boolean; paymentsEnabled: false };
export type AgreementTerms = {
  listingId: string; listingTitle: string; sellerId: string; partnerId: string; currency: "TRY" | "USD" | "EUR";
  commissionType: "fixed" | "rate"; commissionValue: number; calculation: string; entitlement: "verified_sale";
  startsAt: string; endsAt: string | null; attributionDays: number; dueDays: number; cancellation: string; disputes: string;
  notElectronicSignature: true; notPaymentGuarantee: true;
};
export type TrustAgreement = { id: string; partnership_id: string; seller_id: string; partner_id: string; version: number; terms: AgreementTerms; terms_hash: string; created_at: string; seller_accepted_at: string | null; partner_accepted_at: string | null; finalized_at: string | null };
export type TrustTransaction = {
  id: string; partnership_id: string; agreement_id: string; listing_id: string; seller_id: string; partner_id: string; buyer_id: string | null;
  sale_status: keyof typeof saleLabels; commission_status?: keyof typeof commissionLabels; sale_amount: number | null; commission_amount?: number | null;
  currency: "TRY" | "USD" | "EUR"; revision: number; created_at: string; due_at?: string | null; sale_verified_at: string | null;
  seller_sale_confirmed_at: string | null; partner_sale_confirmed_at: string | null;
  seller_payment_declared_at?: string | null; partner_payment_confirmed_at?: string | null; payment_method?: "party_confirmation" | null;
  legacy_commission_id?: string | null;
};
export type TrustReview = { id: string; transaction_id: string; reviewer_id: string; reviewed_user_id: string; reviewer_role: TrustRole; subject_role: TrustRole; dimensions: Record<string, number>; rating: number; comment: string; reveal_at: string; submitted_at: string };
export type TrustDispute = { id: string; transaction_id: string; opened_by: string; reason: string; details: string; status: "open" | "reviewing" | "resolved"; outcome: string | null; decision: string | null; created_at: string; response_due_at: string };
export type TrustEvidence = { id: string; transaction_id: string; uploaded_by: string; kind: string; mime_type: string; byte_size: number; scan_status: "quarantined" | "clean" | "rejected" | "deleted"; created_at: string };
export type TrustDashboard = {
  capabilities: TrustCapabilities; transactions: TrustTransaction[]; agreements: TrustAgreement[]; reviews: TrustReview[]; disputes: TrustDispute[];
  evidence: TrustEvidence[]; responses: { id: string; dispute_id: string; author_id: string; body: string; created_at: string }[];
  events: { user_id: string | null; action: string; entity_id: string; details: Record<string, unknown>; created_at: string }[];
  hasMore?: boolean; cursor?: { at: string; id: string } | null;
  referralCodes?: Record<string, string>;
  referrals?: { id: string; transaction_id: string; status: string; expires_at: string; seller_reason: string | null }[];
  people?: { id: string; name: string; avatar: string | null }[];
};
export type TrustProfile = {
  enabled: boolean; user?: { id: string; full_name: string; avatar_url: string; created_at: string; phone_verified: boolean };
  roles?: Record<TrustRole, { rating: number | null; reviewCount: number; verifiedTransactions: number; mutualPaymentCount: number | null; paymentConfirmationPercent: number | null; openDisputes: number; resolvedDisputes: number; historyLabel: string }>;
  badges?: string[]; criteria?: { minimumPercentSample: number; reviewWindowDays: number; paymentVerification: "party_confirmation"; bankVerified: false };
};
export const reviewCriteria: Record<TrustRole, { key: string; label: string }[]> = {
  seller: [{ key: "payment", label: "Komisyon ödeme süreci" }, { key: "accuracy", label: "Ürün bilgileri" }, { key: "communication", label: "İletişim" }, { key: "agreement", label: "Anlaşmaya uyum" }],
  partner: [{ key: "referral", label: "Alıcı yönlendirme kalitesi" }, { key: "communication", label: "İletişim" }, { key: "accuracy", label: "Doğru bilgilendirme" }, { key: "agreement", label: "Anlaşmaya uyum" }],
  buyer: [{ key: "communication", label: "İletişim" }, { key: "appointment", label: "Randevu ve teslimata uyum" }, { key: "experience", label: "Doğrulanmış işlem deneyimi" }]
};
export const disputeReasons = {
  commission_unpaid: "Komisyon ödenmedi", sale_concealed: "Satış gizlendiği iddiası", incorrect_product: "Yanlış ürün bilgisi",
  referral_conflict: "Alıcı yönlendirme anlaşmazlığı", misleading_evidence: "Sahte veya yanıltıcı belge", other: "Diğer"
} as const;
export const evidenceKinds = { receipt: "Dekont", invoice: "Fatura", sales_slip: "Fiş", delivery: "Teslimat belgesi", product_photo: "Ürün fotoğrafı", correspondence: "İlgili yazışma", other: "Diğer belge" } as const;
export const badgeLabels: Record<string, string> = { phone_verified: "Telefon doğrulandı", new_user: "Henüz işlem geçmişi yok", positive_history: "Olumlu işlem geçmişi", positive_commission: "Komisyon ödeme geçmişi olumlu", under_review: "İncelemede işlem var", partnership_restricted: "Ortaklık yetkisi kısıtlı" };

/** Preview only; authoritative entitlement and calculation are performed in PostgreSQL. */
export function previewCommission(amount: string, type: "fixed" | "rate", value: string): string {
  const cents = (text: string) => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Geçersiz tutar");
    const [whole, fraction = ""] = text.split(".");
    const n = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    if (n <= 0n || n > 99999999999999n) throw new Error("Geçersiz tutar");
    return n;
  };
  const sale = cents(amount), commission = cents(value);
  if (type === "rate" && commission > 9000n) throw new Error("Komisyon %90 değerini aşamaz");
  const result = type === "rate" ? (sale * commission + 5000n) / 10000n : commission;
  return `${result / 100n}.${String(result % 100n).padStart(2, "0")}`;
}

// Technical design only. This application neither receives nor holds funds.
export const ORTAKPAY = { enabled: false, states: ["payment_started", "funds_protected", "awaiting_delivery", "awaiting_buyer", "seller_released", "commission_review", "commission_released", "refund_or_dispute"] } as const;
