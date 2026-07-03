export type CommissionType = "rate" | "fixed";
export type ListingStatus = "draft" | "pending_review" | "active" | "paused" | "sold" | "rejected" | "expired";
export type PartnershipMode = "open" | "approval" | "invite";
export type PartnershipStatus = "active" | "pending" | "rejected" | "blocked" | "cancelled" | "completed";
export type LeadStatus = "new" | "contacted" | "interested" | "converted" | "lost";
export type LeadSource = "whatsapp" | "instagram" | "web" | "phone";
export type PurchaseIntent = "hot" | "warm" | "cold";
export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";
export type SaleStatus = "pending" | "return_pending" | "approved" | "seller_paid" | "paid" | "cancelled" | "disputed";
export type NotificationType = "application" | "lead" | "sale" | "message" | "payout" | "system";
export type UserRole = "user" | "seller" | "partner" | "moderator" | "admin" | "super_admin";
export type ModerationStatus = "open" | "reviewing" | "resolved" | "rejected";
export type ConversationStatus = "open" | "closed" | "blocked";
export type ConversationRole = "buyer" | "seller" | "partner" | "admin";
export type ReviewType = "seller" | "partner" | "product";

export type User = {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  bio: string;
  verifiedPhone: boolean;
  verifiedIdentity: boolean;
  verifiedInstagram?: boolean;
  rating: number;
  listingCount: number;
  successfulSales: number;
  responseRate: number;
  role?: UserRole;
  status?: "active" | "suspended" | "deleted";
  preferences?: Record<string, boolean>;
};

export type Listing = {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
  description: string;
  salesPitch: string[];
  shareTemplates?: {
    instagram: string;
    whatsapp: string;
    tiktok: string;
  };
  adAssets?: string[];
  tags: string[];
  price: number;
  currency?: "TRY" | "USD" | "EUR";
  demo?: boolean;
  commissionType: CommissionType;
  commissionValue: number;
  // Teşvik bonusu: ilk `bonusQuota` satışı yapan ortaklara komisyona ek olarak
  // `bonusAmount` (ilan para birimi) ödenir. Satıcının taahhüdüdür; platform tutmaz.
  bonusAmount?: number;
  bonusQuota?: number;
  category: string;
  location: string;
  // Yapısal konum (filtreleme/index için). location ise insan-okur tek satırdır.
  provinceId?: number;
  districtId?: number;
  neighborhoodId?: number;
  addressVisibility?: "city_only" | "district_only" | "neighborhood" | "full_address_private";
  locationNote?: string;
  image: string;
  status: ListingStatus;
  partnershipMode: PartnershipMode;
  stockCount: number;
  minPartnerRating: number;
  commissionDueDays: number;
  returnWindowDays: number;
  partnerRules: string[];
  partnerCount: number;
  leadCount: number;
  favoriteCount: number;
  reviewCount: number;
  deliveryNote: string;
  contactMethod: "whatsapp" | "phone" | "message";
  createdAt: string;
  featured?: boolean;
};

export type Partnership = {
  id: string;
  listingId: string;
  partnerId: string;
  refCode: string;
  status: PartnershipStatus;
  note: string;
  shareChannel?: string;
  audience?: string;
  platformHandle?: string;
  reachEstimate?: number;
  rejectionReason?: string;
  approvedAt?: string;
  createdAt: string;
};

export type Lead = {
  id: string;
  listingId: string;
  partnershipId: string;
  buyerName: string;
  buyerPhone: string;
  note: string;
  source: LeadSource;
  intent: PurchaseIntent;
  status: LeadStatus;
  createdAt: string;
};

export type Sale = {
  id: string;
  listingId: string;
  partnershipId: string;
  leadId: string;
  amount: number;
  quantity?: number;
  commissionAmount: number;
  status: SaleStatus;
  buyerName?: string;
  deliveryStatus?: OrderStatus;
  returnUntil?: string;
  approvedAt?: string;
  paidAt?: string;
  sellerMarkedPaidAt?: string;
  partnerConfirmedPaidAt?: string;
  payoutNote?: string;
};

export type Order = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  partnershipId?: string;
  amount: number;
  status: OrderStatus;
  createdAt: string;
};

export type Review = {
  id: string;
  listingId: string;
  saleId?: string;
  reviewerId: string;
  reviewedUserId?: string;
  rating: number;
  comment: string;
  type?: ReviewType;
  createdAt: string;
};

export type Favorite = {
  id: string;
  listingId: string;
  userId: string;
};

export type Conversation = {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId?: string;
  partnerId?: string;
  participantIds: string[];
  status: ConversationStatus;
  lastMessageAt: string;
  createdAt: string;
};

export type PlatformSettings = {
  allowSignups: boolean;
  reviewBeforePublish: boolean;
  requireEmailVerification: boolean;
  maintenanceMode: boolean;
  announcement: string;
  announcementActive: boolean;
};

export type Message = {
  id: string;
  conversationId: string;
  listingId: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
  read: boolean;
  attachmentUrl?: string;
  attachmentType?: "image" | "file";
  attachmentName?: string;
};

// Bildirimin ilgili olduğu kayıtlar (derin link için). DB trigger notify_on_lead
// bunları jsonb metadata olarak yazar; istemci bildirime tıklayınca ilana götürür.
export type NotificationMeta = { listingId?: string; leadId?: string; partnershipId?: string };

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  metadata?: NotificationMeta;
};

export type Report = {
  id: string;
  reporterId: string;
  listingId?: string;
  reportedUserId?: string;
  reason: string;
  details: string;
  status: ModerationStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
};



export type SuggestionStatus = "pending" | "approved" | "rejected";

export type CategorySuggestion = {
  id: string;
  userId: string;
  userName?: string;
  listingId?: string;
  suggestedPath: string;
  note?: string;
  status: SuggestionStatus;
  createdAt: string;
};

export type LocationSuggestion = {
  id: string;
  userId: string;
  userName?: string;
  provinceId?: number;
  districtId?: number;
  suggestedName: string;
  type: string;
  note?: string;
  status: SuggestionStatus;
  createdAt: string;
};
