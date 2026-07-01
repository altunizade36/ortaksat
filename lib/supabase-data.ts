import { supabase } from "@/lib/supabase";
import { displayText, repairTurkishText } from "@/lib/text";
import type { Conversation, Favorite, Lead, Listing, Message, Notification, Order, Partnership, Report, Review, Sale, User } from "@/lib/types";

type PublicListingCardRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  sales_pitch: string[] | null;
  share_templates?: Listing["shareTemplates"] | null;
  ad_assets?: string[] | null;
  tags: string[] | null;
  price: number | string;
  commission_type: Listing["commissionType"];
  commission_value: number | string;
  category: string;
  location: string;
  status: Listing["status"];
  partnership_mode: Listing["partnershipMode"];
  stock_count: number | null;
  min_partner_rating: number | string | null;
  commission_due_days: number | null;
  return_window_days: number | null;
  partner_rules: string[] | null;
  delivery_note: string | null;
  contact_method: Listing["contactMethod"];
  created_at: string;
  image_url: string | null;
  partner_count: number | string | null;
  lead_count: number | string | null;
  favorite_count: number | string | null;
  review_count: number | string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  verified_phone: boolean;
  verified_identity: boolean;
  verified_instagram?: boolean | null;
  rating: number | string | null;
  response_rate: number | null;
  role?: User["role"] | null;
};

export type MarketplaceSnapshot = {
  listings: Listing[];
  users: User[];
};

export type AccountSnapshot = {
  partnerships: Partnership[];
  leads: Lead[];
  sales: Sale[];
  orders: Order[];
  reviews: Review[];
  favorites: Favorite[];
  conversations: Conversation[];
  messages: Message[];
  notifications: Notification[];
  reports: Report[];
};

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
    .join("");
}

function mapProfile(row: ProfileRow): User {
  const name = displayText(row.full_name, "Ortaksat kullanıcısı");

  return {
    id: row.id,
    name,
    phone: row.phone ?? "",
    avatar: row.avatar_url || initials(name) || "OS",
    bio: repairTurkishText(row.bio ?? ""),
    verifiedPhone: row.verified_phone,
    verifiedIdentity: row.verified_identity,
    verifiedInstagram: Boolean(row.verified_instagram),
    rating: toNumber(row.rating),
    listingCount: 0,
    successfulSales: 0,
    responseRate: row.response_rate ?? 0,
    role: row.role ?? "user"
  };
}

function mapListing(row: PublicListingCardRow): Listing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: displayText(row.title),
    slug: row.slug,
    description: repairTurkishText(row.description),
    salesPitch: (row.sales_pitch ?? []).map(repairTurkishText),
    shareTemplates: row.share_templates ?? undefined,
    adAssets: row.ad_assets ?? [],
    tags: (row.tags ?? []).map(repairTurkishText),
    price: toNumber(row.price),
    commissionType: row.commission_type,
    commissionValue: toNumber(row.commission_value),
    category: displayText(row.category),
    location: displayText(row.location),
    image: row.image_url ?? "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200",
    status: row.status,
    partnershipMode: row.partnership_mode,
    stockCount: row.stock_count ?? 0,
    minPartnerRating: toNumber(row.min_partner_rating),
    commissionDueDays: row.commission_due_days ?? 0,
    returnWindowDays: row.return_window_days ?? 0,
    partnerRules: (row.partner_rules ?? []).map(repairTurkishText),
    partnerCount: toNumber(row.partner_count),
    leadCount: toNumber(row.lead_count),
    favoriteCount: toNumber(row.favorite_count),
    reviewCount: toNumber(row.review_count),
    deliveryNote: repairTurkishText(row.delivery_note ?? ""),
    contactMethod: row.contact_method,
    createdAt: row.created_at.slice(0, 10)
  };
}

// Tek bir ilanı id ile çeker (paylaşılan link herkeste açılsın diye). Aktif ilanlar
// listing_public_cards (RLS-güvenli, public) üzerinden gelir; sahibi de getirilir.
export async function fetchListingById(id: string): Promise<{ listing: Listing; owner?: User } | null> {
  if (!supabase || !id) return null;
  const { data, error } = await supabase.from("listing_public_cards").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const listing = mapListing(data as PublicListingCardRow);
  let owner: User | undefined;
  const prof = await supabase.from("profiles").select("*").eq("id", listing.ownerId).maybeSingle();
  if (prof.data) owner = mapProfile(prof.data as ProfileRow);
  return { listing, owner };
}

export type AuditEntry = { id: number; userId: string | null; action: string; entityType: string | null; entityId: string | null; createdAt: string };

// Admin denetim kayıtları (activity_logs). RLS yalnızca admin'e okuma verir;
// admin değilse boş döner. Son 50 kayıt + son 1 saatteki hız-limiti olay sayısı.
export async function fetchAdminAudit(): Promise<{ logs: AuditEntry[]; rateHits: number } | null> {
  if (!supabase) return null;
  const [logsRes, rateRes] = await Promise.all([
    supabase.from("activity_logs").select("id,user_id,action,entity_type,entity_id,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("rate_limits").select("id", { count: "exact", head: true }).gte("occurred_at", new Date(Date.now() - 3600_000).toISOString())
  ]);
  if (logsRes.error) return null; // admin değil / erişim yok
  const logs: AuditEntry[] = (logsRes.data ?? []).map((r: { id: number; user_id: string | null; action: string; entity_type: string | null; entity_id: string | null; created_at: string }) => ({
    id: r.id, userId: r.user_id, action: r.action, entityType: r.entity_type, entityId: r.entity_id, createdAt: (r.created_at || "").slice(0, 16).replace("T", " ")
  }));
  return { logs, rateHits: rateRes.count ?? 0 };
}

export async function loadMarketplaceSnapshot(): Promise<MarketplaceSnapshot | null> {
  if (!supabase) return null;

  const [listingsResult, profilesResult] = await Promise.all([
    supabase
      .from("listing_public_cards")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(90),
    supabase.from("profiles").select("*").limit(200)
  ]);

  if (listingsResult.error || profilesResult.error) {
    return null;
  }

  const listings = ((listingsResult.data ?? []) as PublicListingCardRow[]).map(mapListing);
  const users = ((profilesResult.data ?? []) as ProfileRow[]).map(mapProfile);

  if (listings.length === 0 || users.length === 0) {
    return null;
  }

  const listingCounts = listings.reduce<Record<string, number>>((acc, listing) => {
    acc[listing.ownerId] = (acc[listing.ownerId] ?? 0) + 1;
    return acc;
  }, {});

  return {
    listings,
    users: users.map((user) => ({ ...user, listingCount: listingCounts[user.id] ?? user.listingCount }))
  };
}

export async function loadAccountSnapshot(userId: string): Promise<AccountSnapshot | null> {
  if (!supabase) return null;

  const { data: ownedListings } = await supabase.from("listings").select("id").eq("owner_id", userId);
  const ownedListingIds = (ownedListings ?? []).map((item) => item.id as string);

  const [
    partnershipsResult,
    leadsResult,
    commissionsResult,
    ordersResult,
    reviewsResult,
    favoritesResult,
    conversationsResult,
    messagesResult,
    notificationsResult,
    reportsResult
  ] = await Promise.all([
    supabase
      .from("partnerships")
      .select("*")
      .or(`partner_id.eq.${userId}${ownedListingIds.length ? `,listing_id.in.(${ownedListingIds.join(",")})` : ""}`)
      .limit(500),
    ownedListingIds.length
      ? supabase.from("leads").select("*").in("listing_id", ownedListingIds).order("created_at", { ascending: false }).limit(500)
      : supabase.from("leads").select("*").eq("id", "00000000-0000-0000-0000-000000000000"),
    supabase.from("commissions").select("*").order("created_at", { ascending: false }).limit(500),
    ownedListingIds.length
      ? supabase.from("orders").select("*").in("listing_id", ownedListingIds).order("created_at", { ascending: false }).limit(500)
      : supabase.from("orders").select("*").eq("seller_id", userId).order("created_at", { ascending: false }).limit(500),
    supabase.from("reviews").select("*").eq("reviewer_id", userId).order("created_at", { ascending: false }).limit(300),
    supabase.from("favorites").select("*").eq("user_id", userId).limit(500),
    supabase.from("conversations").select("*").contains("participant_ids", [userId]).order("last_message_at", { ascending: false }).limit(200),
    supabase.from("messages").select("*").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order("created_at", { ascending: false }).limit(1000),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(300)
  ]);

  const firstError =
    partnershipsResult.error ??
    leadsResult.error ??
    commissionsResult.error ??
    ordersResult.error ??
    reviewsResult.error ??
    favoritesResult.error ??
    conversationsResult.error ??
    messagesResult.error ??
    notificationsResult.error ??
    reportsResult.error;

  if (firstError) {
    console.warn("Supabase account load failed", firstError);
    return null;
  }

  return {
    partnerships: (partnershipsResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      partnerId: row.partner_id,
      refCode: row.ref_code,
      status: row.status,
      note: row.note,
      shareChannel: row.share_channel ?? undefined,
      audience: row.audience ?? undefined,
      platformHandle: row.platform_handle ?? undefined,
      reachEstimate: toNumber(row.reach_estimate),
      rejectionReason: row.rejection_reason ?? undefined,
      approvedAt: row.approved_at?.slice(0, 10),
      createdAt: row.created_at.slice(0, 10)
    })),
    leads: (leadsResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      partnershipId: row.partnership_id,
      buyerName: row.buyer_name,
      buyerPhone: row.buyer_phone,
      note: row.note,
      source: row.source,
      intent: row.intent,
      status: row.status,
      createdAt: row.created_at.slice(0, 10)
    })),
    sales: (commissionsResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      partnershipId: row.partnership_id,
      leadId: row.lead_id ?? "",
      amount: toNumber(row.sale_amount, toNumber(row.amount)),
      quantity: toNumber(row.quantity, 1),
      commissionAmount: toNumber(row.amount),
      status: row.status,
      buyerName: row.buyer_name ?? undefined,
      deliveryStatus: row.delivery_status ?? undefined,
      returnUntil: row.return_until?.slice(0, 10),
      approvedAt: row.approved_at?.slice(0, 10),
      paidAt: row.paid_at?.slice(0, 10),
      sellerMarkedPaidAt: row.seller_marked_paid_at?.slice(0, 10),
      partnerConfirmedPaidAt: row.partner_confirmed_paid_at?.slice(0, 10),
      payoutNote: row.payout_note ?? undefined
    })),
    orders: (ordersResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      buyerId: row.buyer_id ?? "",
      sellerId: row.seller_id,
      partnershipId: row.partnership_id ?? undefined,
      amount: toNumber(row.amount),
      status: row.status,
      createdAt: row.created_at.slice(0, 10)
    })),
    reviews: (reviewsResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      saleId: row.sale_id ?? undefined,
      reviewerId: row.reviewer_id,
      reviewedUserId: row.reviewed_user_id ?? undefined,
      rating: row.rating,
      comment: row.comment,
      type: row.type ?? "product",
      createdAt: row.created_at.slice(0, 10)
    })),
    favorites: (favoritesResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      userId: row.user_id
    })),
    conversations: (conversationsResult.data ?? []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      sellerId: row.seller_id,
      buyerId: row.buyer_id ?? undefined,
      partnerId: row.partner_id ?? undefined,
      participantIds: row.participant_ids ?? [],
      status: row.status,
      lastMessageAt: row.last_message_at?.slice(0, 16).replace("T", " ") ?? row.created_at.slice(0, 16).replace("T", " "),
      createdAt: row.created_at.slice(0, 16).replace("T", " ")
    })),
    messages: (messagesResult.data ?? []).map((row) => ({
      id: row.id,
      conversationId: row.conversation_id ?? `${row.listing_id}-${row.sender_id}-${row.receiver_id}`,
      listingId: row.listing_id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      body: row.body,
      createdAt: row.created_at.slice(0, 16).replace("T", " "),
      read: row.read,
      attachmentUrl: row.attachment_url ?? undefined,
      attachmentType: row.attachment_type ?? undefined,
      attachmentName: row.attachment_name ?? undefined
    })),
    notifications: (notificationsResult.data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      read: row.read,
      createdAt: row.created_at.slice(0, 10)
    })),
    reports: (reportsResult.data ?? []).map((row) => ({
      id: row.id,
      reporterId: row.reporter_id,
      listingId: row.listing_id ?? undefined,
      reportedUserId: row.reported_user_id ?? undefined,
      reason: row.reason,
      details: row.details,
      status: row.status,
      resolvedBy: row.resolved_by ?? undefined,
      resolvedAt: row.resolved_at?.slice(0, 10),
      createdAt: row.created_at.slice(0, 10)
    }))
  };
}

