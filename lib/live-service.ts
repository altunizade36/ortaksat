import { supabase } from "@/lib/supabase";
import { commissionAmount } from "@/lib/format";
import type { Conversation, Lead, Listing, Message, ModerationStatus, Notification, Partnership, Report, Review, Sale, User } from "@/lib/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLiveUser(user: User) {
  return Boolean(supabase && uuidPattern.test(user.id));
}

export function makeUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16) >> (Number(char) / 4)).toString(16)
  );
}

export async function ensureProfile(user: User) {
  if (!supabase || !isLiveUser(user)) return;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: user.name,
    phone: user.phone || null,
    avatar_url: user.avatar.length > 3 ? user.avatar : null,
    bio: user.bio
  });

  if (error) console.warn("Supabase profile upsert failed", error);
}

export async function updateProfileLive(user: Pick<User, "id" | "name" | "phone" | "avatar" | "bio" | "verifiedPhone">) {
  if (!supabase || !uuidPattern.test(user.id)) return false;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: user.name,
      phone: user.phone || null,
      avatar_url: user.avatar.length > 3 ? user.avatar : null,
      bio: user.bio,
      verified_phone: user.verifiedPhone
    })
    .eq("id", user.id);

  if (error) {
    console.warn("Supabase profile update failed", error);
    return false;
  }

  return true;
}

export async function insertListing(listing: Listing) {
  if (!supabase) return;

  const { error } = await supabase.from("listings").insert({
    id: listing.id,
    owner_id: listing.ownerId,
    title: listing.title,
    slug: listing.slug,
    description: listing.description,
    price: listing.price,
    commission_type: listing.commissionType,
    commission_value: listing.commissionValue,
    category: listing.category,
    location: listing.location,
    status: listing.status,
    partnership_mode: listing.partnershipMode,
    stock_count: listing.stockCount,
    min_partner_rating: listing.minPartnerRating,
    commission_due_days: listing.commissionDueDays,
    return_window_days: listing.returnWindowDays,
    partner_rules: listing.partnerRules,
    delivery_note: listing.deliveryNote,
    contact_method: listing.contactMethod,
    sales_pitch: listing.salesPitch,
    share_templates: listing.shareTemplates ?? null,
    ad_assets: listing.adAssets ?? [],
    tags: listing.tags
  });

  if (error) {
    console.warn("Supabase listing insert failed", error);
    return;
  }

  if (listing.image) {
    const imageError = (await supabase.from("listing_images").insert({
      listing_id: listing.id,
      url: listing.image,
      sort_order: 0
    })).error;
    if (imageError) console.warn("Supabase listing image insert failed", imageError);
  }
}

// Yüklemede izin verilen tipler ve boyut sınırları (DB bucket limitiyle uyumlu).
const ALLOWED_IMAGE_TYPES: Record<string, string> = { png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg" };
const ALLOWED_VIDEO_TYPES: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", webm: "video/webm" };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 MB (video dahil; bucket limiti)

export async function uploadListingImage(uri: string, userId: string) {
  if (!supabase || !uuidPattern.test(userId) || !uri.startsWith("file")) return uri;

  const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const contentType = ALLOWED_IMAGE_TYPES[extension] ?? ALLOWED_VIDEO_TYPES[extension];
  if (!contentType) {
    console.warn("Reddedilen dosya tipi:", extension);
    return uri; // izinsiz tip: yükleme yapma, orijinal uri ile devam (RLS/bucket de reddeder)
  }
  const isVideo = Boolean(ALLOWED_VIDEO_TYPES[extension]);
  const path = `${userId}/${makeUuid()}.${extension}`;
  const response = await fetch(uri);
  const body = await response.blob();
  const limit = isVideo ? MAX_MEDIA_BYTES : MAX_IMAGE_BYTES;
  if (body.size > limit) {
    console.warn(`Dosya çok büyük (${Math.round(body.size / 1024)}KB > ${Math.round(limit / 1024)}KB)`);
    return uri; // boyut aşımı: yükleme yapma
  }
  const { error } = await supabase.storage.from("listing-images").upload(path, body, {
    contentType,
    upsert: false
  });

  if (error) {
    console.warn("Supabase listing image upload failed", error);
    return uri;
  }

  return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
}

export async function uploadProfileAvatar(uri: string, userId: string) {
  if (!supabase || !uuidPattern.test(userId) || !uri.startsWith("file")) return uri;

  const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const contentType = ALLOWED_IMAGE_TYPES[extension];
  if (!contentType) {
    console.warn("Reddedilen avatar tipi:", extension);
    return uri;
  }
  const path = `${userId}/avatar-${makeUuid()}.${extension}`;
  const response = await fetch(uri);
  const body = await response.blob();
  if (body.size > MAX_IMAGE_BYTES) {
    console.warn("Avatar çok büyük");
    return uri;
  }
  const { error } = await supabase.storage.from("profile-avatars").upload(path, body, {
    contentType,
    upsert: false
  });

  if (error) {
    console.warn("Supabase profile avatar upload failed", error);
    return uri;
  }

  return supabase.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl;
}

export async function insertPartnership(partnership: Partnership) {
  if (!supabase) return;
  const { error } = await supabase.from("partnerships").insert({
    id: partnership.id,
    listing_id: partnership.listingId,
    partner_id: partnership.partnerId,
    ref_code: partnership.refCode,
    status: partnership.status,
    note: partnership.note,
    share_channel: partnership.shareChannel ?? null,
    audience: partnership.audience ?? null,
    platform_handle: partnership.platformHandle ?? null,
    reach_estimate: partnership.reachEstimate ?? 0,
    approved_at: partnership.approvedAt ?? null
  });
  if (error) console.warn("Supabase partnership insert failed", error);
}

export async function updatePartnershipStatus(partnership: Partnership) {
  if (!supabase) return;
  const { error } = await supabase
    .from("partnerships")
    .update({
      status: partnership.status,
      rejection_reason: partnership.rejectionReason ?? null,
      share_channel: partnership.shareChannel ?? null,
      audience: partnership.audience ?? null,
      platform_handle: partnership.platformHandle ?? null,
      reach_estimate: partnership.reachEstimate ?? 0,
      approved_at: partnership.approvedAt ?? null
    })
    .eq("id", partnership.id);
  if (error) console.warn("Supabase partnership update failed", error);
}

export async function insertLead(lead: Lead) {
  if (!supabase) return;
  const { error } = await supabase.from("leads").insert({
    id: lead.id,
    listing_id: lead.listingId,
    partnership_id: lead.partnershipId,
    buyer_name: lead.buyerName,
    buyer_phone: lead.buyerPhone,
    note: lead.note,
    source: lead.source,
    intent: lead.intent,
    status: lead.status
  });
  if (error) console.warn("Supabase lead insert failed", error);
}

export type ReferralLink = {
  refCode: string;
  partnershipId: string;
  listingId: string;
  slug: string;
  title: string;
  price: number;
  category: string;
  location: string;
  imageUrl?: string;
};

export async function resolveReferralLink(slug: string, refCode: string): Promise<ReferralLink | null> {
  if (!supabase || !slug || !refCode) return null;

  const { data, error } = await supabase
    .from("referral_public_links")
    .select("*")
    .eq("slug", slug)
    .eq("ref_code", refCode)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn("Supabase referral resolve failed", error);
    return null;
  }

  return {
    refCode: data.ref_code,
    partnershipId: data.partnership_id,
    listingId: data.listing_id,
    slug: data.slug,
    title: data.title,
    price: Number(data.price ?? 0),
    category: data.category,
    location: data.location,
    imageUrl: data.image_url ?? undefined
  };
}

export async function insertReferralLead(input: {
  listingId: string;
  partnershipId: string;
  buyerName: string;
  buyerPhone: string;
  note: string;
}) {
  if (!supabase) return false;

  const { error } = await supabase.from("leads").insert({
    id: makeUuid(),
    listing_id: input.listingId,
    partnership_id: input.partnershipId,
    buyer_name: input.buyerName,
    buyer_phone: input.buyerPhone,
    note: input.note,
    source: "web",
    intent: "warm",
    status: "new"
  });

  if (error) {
    console.warn("Supabase referral lead insert failed", error);
    return false;
  }

  return true;
}

export async function updateLeadStatusLive(lead: Lead) {
  if (!supabase) return;
  const { error } = await supabase.from("leads").update({ status: lead.status }).eq("id", lead.id);
  if (error) console.warn("Supabase lead update failed", error);
}

export async function insertSaleFromLead(sale: Sale, listing: Listing) {
  if (!supabase) return;

  const orderId = makeUuid();
  const orderError = (await supabase.from("orders").insert({
    id: orderId,
    listing_id: listing.id,
    seller_id: listing.ownerId,
    partnership_id: sale.partnershipId,
    amount: sale.amount,
    status: "confirmed"
  })).error;

  if (orderError) {
    console.warn("Supabase order insert failed", orderError);
    return;
  }

  const commissionError = (await supabase.from("commissions").insert({
    id: sale.id,
    order_id: orderId,
    listing_id: sale.listingId,
    partnership_id: sale.partnershipId,
    lead_id: sale.leadId,
    amount: sale.commissionAmount,
    sale_amount: sale.amount,
    quantity: sale.quantity ?? 1,
    buyer_name: sale.buyerName ?? null,
    delivery_status: sale.deliveryStatus ?? "confirmed",
    return_until: sale.returnUntil ?? null,
    status: sale.status,
    approved_at: sale.approvedAt ?? null,
    paid_at: sale.paidAt ?? null,
    seller_marked_paid_at: sale.sellerMarkedPaidAt ?? null,
    partner_confirmed_paid_at: sale.partnerConfirmedPaidAt ?? null,
    payout_note: sale.payoutNote ?? null
  })).error;

  if (commissionError) console.warn("Supabase commission insert failed", commissionError);
}

export async function updateSaleStatusLive(sale: Sale) {
  if (!supabase) return;
  const { error } = await supabase
    .from("commissions")
    .update({
      status: sale.status,
      approved_at: sale.approvedAt ?? null,
      paid_at: sale.paidAt ?? null,
      seller_marked_paid_at: sale.sellerMarkedPaidAt ?? null,
      partner_confirmed_paid_at: sale.partnerConfirmedPaidAt ?? null,
      payout_note: sale.payoutNote ?? null
    })
    .eq("id", sale.id);
  if (error) console.warn("Supabase commission update failed", error);
}

export async function updateListingStatusLive(listing: Listing) {
  if (!supabase) return;
  const { error } = await supabase.from("listings").update({ status: listing.status }).eq("id", listing.id);
  if (error) console.warn("Supabase listing status update failed", error);
}

export async function updateListingInventoryLive(listing: Pick<Listing, "id" | "status" | "stockCount">) {
  if (!supabase) return;
  const { error } = await supabase
    .from("listings")
    .update({
      status: listing.status,
      stock_count: listing.stockCount
    })
    .eq("id", listing.id);
  if (error) console.warn("Supabase listing inventory update failed", error);
}

export async function updateListingLive(listing: Listing) {
  if (!supabase) return false;

  const { error } = await supabase
    .from("listings")
    .update({
      title: listing.title,
      slug: listing.slug,
      description: listing.description,
      price: listing.price,
      commission_type: listing.commissionType,
      commission_value: listing.commissionValue,
      category: listing.category,
      location: listing.location,
      status: listing.status,
      partnership_mode: listing.partnershipMode,
      stock_count: listing.stockCount,
      min_partner_rating: listing.minPartnerRating,
      commission_due_days: listing.commissionDueDays,
      return_window_days: listing.returnWindowDays,
      partner_rules: listing.partnerRules,
      delivery_note: listing.deliveryNote,
      contact_method: listing.contactMethod,
      sales_pitch: listing.salesPitch,
      share_templates: listing.shareTemplates ?? null,
      ad_assets: listing.adAssets ?? [],
      tags: listing.tags
    })
    .eq("id", listing.id);

  if (error) {
    console.warn("Supabase listing update failed", error);
    return false;
  }

  if (listing.image) {
    const deleteError = (await supabase.from("listing_images").delete().eq("listing_id", listing.id).eq("sort_order", 0)).error;
    if (deleteError) console.warn("Supabase listing image replace delete failed", deleteError);
    const imageError = (await supabase.from("listing_images").insert({
      listing_id: listing.id,
      url: listing.image,
      sort_order: 0
    })).error;
    if (imageError) console.warn("Supabase listing image replace insert failed", imageError);
  }

  return true;
}

export async function insertFavorite(listingId: string, userId: string, id: string) {
  if (!supabase) return;
  const { error } = await supabase.from("favorites").insert({ id, listing_id: listingId, user_id: userId });
  if (error) console.warn("Supabase favorite insert failed", error);
}

export async function deleteFavorite(listingId: string, userId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("favorites").delete().eq("listing_id", listingId).eq("user_id", userId);
  if (error) console.warn("Supabase favorite delete failed", error);
}

export async function insertReview(review: Review) {
  if (!supabase) return;
  const { error } = await supabase.from("reviews").insert({
    id: review.id,
    listing_id: review.listingId,
    reviewer_id: review.reviewerId,
    rating: review.rating,
    comment: review.comment,
    type: review.type ?? "product"
  });
  if (error) console.warn("Supabase review insert failed", error);
}

export async function insertConversation(conversation: Conversation) {
  if (!supabase) return;
  const { error } = await supabase.from("conversations").insert({
    id: conversation.id,
    listing_id: conversation.listingId,
    seller_id: conversation.sellerId,
    buyer_id: conversation.buyerId ?? null,
    partner_id: conversation.partnerId ?? null,
    participant_ids: conversation.participantIds,
    status: conversation.status,
    last_message_at: conversation.lastMessageAt
  });
  if (error) console.warn("Supabase conversation insert failed", error);
}

export async function insertMessage(message: Message) {
  if (!supabase) return;
  const { error } = await supabase.from("messages").insert({
    id: message.id,
    conversation_id: message.conversationId,
    listing_id: message.listingId,
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    body: message.body,
    read: message.read
  });
  if (error) console.warn("Supabase message insert failed", error);
}


export async function markMessageReadLive(message: Message) {
  if (!supabase) return;
  const { error } = await supabase.from("messages").update({ read: true }).eq("id", message.id);
  if (error) console.warn("Supabase message read update failed", error);
}
export async function insertNotification(notification: Notification) {
  if (!supabase) return;
  const { error } = await supabase.from("notifications").insert({
    id: notification.id,
    user_id: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    read: notification.read
  });
  if (error) console.warn("Supabase notification insert failed", error);
}

export async function markNotificationReadLive(notification: Notification) {
  if (!supabase) return;
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", notification.id);
  if (error) console.warn("Supabase notification update failed", error);
}

export async function insertReport(input: {
  reporterId: string;
  listingId?: string;
  reportedUserId?: string;
  reason: string;
  details?: string;
}) {
  if (!supabase || !uuidPattern.test(input.reporterId)) return null;
  const id = makeUuid();

  const { error } = await supabase.from("reports").insert({
    id,
    reporter_id: input.reporterId,
    listing_id: input.listingId ?? null,
    reported_user_id: input.reportedUserId ?? null,
    reason: input.reason,
    details: input.details ?? ""
  });

  if (error) {
    console.warn("Supabase report insert failed", error);
    return null;
  }

  return id;
}

export async function updateReportStatusLive(report: Report, status: ModerationStatus, resolverId: string) {
  if (!supabase || !uuidPattern.test(resolverId)) return false;

  const { error } = await supabase
    .from("reports")
    .update({
      status,
      resolved_by: status === "resolved" || status === "rejected" ? resolverId : null,
      resolved_at: status === "resolved" || status === "rejected" ? new Date().toISOString() : null
    })
    .eq("id", report.id);

  if (error) {
    console.warn("Supabase report update failed", error);
    return false;
  }

  return true;
}

export async function recordLegalConsentLive(userId: string, documentType: "privacy" | "terms" | "kvkk" | "seller_rules") {
  if (!supabase || !uuidPattern.test(userId)) return false;

  const { error } = await supabase.from("legal_consents").upsert({
    user_id: userId,
    document_type: documentType,
    version: "2026-06-11",
    accepted: true,
    accepted_at: new Date().toISOString()
  });

  if (error) {
    console.warn("Supabase legal consent upsert failed", error);
    return false;
  }

  return true;
}

export async function createSupportTicketLive(input: { userId: string; subject: string; message: string }) {
  if (!supabase || !uuidPattern.test(input.userId)) return false;

  const { error } = await supabase.from("support_tickets").insert({
    id: makeUuid(),
    user_id: input.userId,
    subject: input.subject,
    message: input.message
  });

  if (error) {
    console.warn("Supabase support ticket insert failed", error);
    return false;
  }

  return true;
}

export async function requestAccountDeletionLive(input: { userId: string; reason: string }) {
  if (!supabase || !uuidPattern.test(input.userId)) return false;

  const { error } = await supabase.from("account_deletion_requests").insert({
    id: makeUuid(),
    user_id: input.userId,
    reason: input.reason
  });

  if (error) {
    console.warn("Supabase account deletion request insert failed", error);
    return false;
  }

  return true;
}


