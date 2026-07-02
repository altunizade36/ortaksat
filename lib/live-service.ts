import { supabase } from "@/lib/supabase";
import { commissionAmount } from "@/lib/format";
import type { Conversation, Lead, Listing, Message, ModerationStatus, Notification, Partnership, Report, Review, Sale, User } from "@/lib/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLiveUser(user: User) {
  return Boolean(supabase && uuidPattern.test(user.id));
}

const SETTING_COLUMN: Record<string, string> = {
  allowSignups: "allow_signups",
  reviewBeforePublish: "review_before_publish",
  requireEmailVerification: "require_email_verification",
  maintenanceMode: "maintenance_mode"
};

/** Kullanici rolunu gunceller (yalniz admin; RLS harden_profile_roles uygular). */
export async function updateUserRoleLive(userId: string, role: string) {
  if (!supabase) return;
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) console.warn("User role update failed", error);
}

/** Kullanici durumunu gunceller (active/suspended/deleted; yalniz admin). */
export async function updateUserStatusLive(userId: string, status: string) {
  if (!supabase) return;
  const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
  if (error) console.warn("User status update failed", error);
}

/** Kullanici dogrulama rozetini (telefon/kimlik) admin manuel gunceller. */
export async function updateUserVerificationLive(userId: string, field: "verifiedPhone" | "verifiedIdentity", value: boolean) {
  if (!supabase) return;
  const column = field === "verifiedPhone" ? "verified_phone" : "verified_identity";
  const { error } = await supabase.from("profiles").update({ [column]: value }).eq("id", userId);
  if (error) console.warn("User verification update failed", error);
}

/** Ilana herkese acik soru sorar (giris gerekli; RLS asker_id=auth.uid). */
export async function askQuestionLive(listingId: string, askerId: string, askerName: string, question: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Canlı bağlantı yok." };
  const { error } = await supabase.from("listing_questions").insert({ listing_id: listingId, asker_id: askerId, asker_name: askerName, question: question.trim() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Ilan sahibi soruyu cevaplar (RLS: yalniz ilan sahibi). */
export async function answerQuestionLive(questionId: string, answer: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Canlı bağlantı yok." };
  const { error } = await supabase.from("listing_questions").update({ answer: answer.trim(), answered_at: new Date().toISOString() }).eq("id", questionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Kullanicinin tercih (bildirim/magaza ayarlari) JSONB kolonunu gunceller. */
export async function savePreferencesLive(userId: string, preferences: Record<string, boolean>): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("profiles").update({ preferences }).eq("id", userId);
  if (error) { console.warn("Preferences update failed", error); return false; }
  return true;
}

/** E-bulten abonesi ekler (herkes; RLS public insert). */
export async function subscribeNewsletterLive(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Canlı bağlantı yok." };
  const { error } = await supabase.from("newsletter_subscribers").upsert({ email: email.toLowerCase().trim() }, { onConflict: "email" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Giris yapmis kullanicinin sifresini gunceller (Supabase Auth). */
export async function changePasswordLive(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Canlı bağlantı yok." };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Admin: birden cok kullaniciya ayni bildirimi ekler (duyuru). */
export async function insertBulkNotifications(rows: Array<{ id: string; userId: string; type: string; title: string; body: string }>) {
  if (!supabase || rows.length === 0) return;
  const payload = rows.map((r) => ({ id: r.id, user_id: r.userId, type: r.type, title: r.title, body: r.body, read: false }));
  const { error } = await supabase.from("notifications").insert(payload);
  if (error) console.warn("Bulk notification insert failed", error);
}

/** Ilani one cikar/geri al (admin; RLS uygular). */
export async function updateListingFeaturedLive(listingId: string, featured: boolean) {
  if (!supabase) return;
  const { error } = await supabase.from("listings").update({ featured }).eq("id", listingId);
  if (error) console.warn("Listing featured update failed", error);
}

/** Ilani kalici siler (sahibi veya admin; RLS uygular). Iliskili kayitlar FK cascade ile temizlenir. */
export async function deleteListingLive(listingId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("listings").delete().eq("id", listingId);
  if (error) console.warn("Listing delete failed", error);
}

/** Ekstra kategori ekle/guncelle (admin). key uniq -> upsert. */
export async function saveCategoryLive(c: { id?: string; key: string; label: string; slug: string; image: string; subcategories: Array<{ label: string; slug: string }>; sortOrder: number; isActive: boolean }) {
  if (!supabase) return;
  const row: Record<string, unknown> = { key: c.key, label: c.label, slug: c.slug, image: c.image, subcategories: c.subcategories, sort_order: c.sortOrder, is_active: c.isActive };
  if (c.id) row.id = c.id;
  const { error } = await supabase.from("categories").upsert(row, { onConflict: "key" });
  if (error) console.warn("Category upsert failed", error);
}
export async function deleteCategoryLive(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) console.warn("Category delete failed", error);
}
/** Toplu ekstra kategori yukleme (JSON ice aktarim). key uniq -> upsert. */
export async function bulkInsertCategoriesLive(rows: Array<{ id: string; key: string; label: string; slug: string; image: string; subcategories: Array<{ label: string; slug: string }>; sortOrder: number; isActive: boolean }>) {
  if (!supabase || rows.length === 0) return;
  const payload = rows.map((c) => ({ id: c.id, key: c.key, label: c.label, slug: c.slug, image: c.image, subcategories: c.subcategories, sort_order: c.sortOrder, is_active: c.isActive }));
  const { error } = await supabase.from("categories").upsert(payload, { onConflict: "key" });
  if (error) console.warn("Bulk category insert failed", error);
}

/** Blog yazisi ekle/guncelle (admin). slug uniq -> upsert. */
export async function saveBlogPostLive(p: { id?: string; slug: string; category: string; title: string; excerpt: string; author: string; authorRole: string; readMin: number; image: string; featured: boolean; body: string[]; status: string }) {
  if (!supabase) return;
  const row: Record<string, unknown> = {
    slug: p.slug, category: p.category, title: p.title, excerpt: p.excerpt, author: p.author, author_role: p.authorRole,
    read_min: p.readMin, image: p.image, featured: p.featured, body: p.body, status: p.status, updated_at: new Date().toISOString()
  };
  if (p.id) row.id = p.id;
  const { error } = await supabase.from("blog_posts").upsert(row, { onConflict: "slug" });
  if (error) console.warn("Blog upsert failed", error);
}
export async function deleteBlogPostLive(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) console.warn("Blog delete failed", error);
}
export async function saveContentPageLive(p: { slug: string; title: string; body: string; seoTitle: string; seoDescription: string }) {
  if (!supabase) return;
  const { error } = await supabase.from("content_pages").upsert({ slug: p.slug, title: p.title, body: p.body, seo_title: p.seoTitle, seo_description: p.seoDescription, updated_at: new Date().toISOString() }, { onConflict: "slug" });
  if (error) console.warn("Content page upsert failed", error);
}
export async function saveSeoSettingLive(p: { path: string; metaTitle: string; metaDescription: string; ogImage: string; noindex: boolean }) {
  if (!supabase) return;
  const { error } = await supabase.from("seo_settings").upsert({ path: p.path, meta_title: p.metaTitle, meta_description: p.metaDescription, og_image: p.ogImage, noindex: p.noindex, updated_at: new Date().toISOString() }, { onConflict: "path" });
  if (error) console.warn("SEO upsert failed", error);
}

/** Site duyurusunu (metin + aktiflik) gunceller (yalniz admin). */
export async function updateAnnouncementLive(text: string, active: boolean) {
  if (!supabase) return;
  const { error } = await supabase
    .from("platform_settings")
    .update({ announcement: text, announcement_active: active, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) console.warn("Announcement update failed", error);
}

/** Platform ayarini gunceller (yalniz admin; RLS uygular). */
export async function updatePlatformSettingLive(key: string, value: boolean) {
  if (!supabase) return;
  const column = SETTING_COLUMN[key];
  if (!column) return;
  const { error } = await supabase
    .from("platform_settings")
    .update({ [column]: value, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) console.warn("Platform setting update failed", error);
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
    currency: listing.currency ?? "TRY",
    province_id: listing.provinceId ?? null,
    district_id: listing.districtId ?? null,
    neighborhood_id: listing.neighborhoodId ?? null,
    address_visibility: listing.addressVisibility ?? "neighborhood",
    location_note: listing.locationNote ?? null,
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

// Görseli canvas ile verilen boyut/kalitede JPEG'e çevirir (tek geçiş).
async function renderJpeg(bitmap: ImageBitmap, maxDim: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}

// Web'de görseli en fazla maxDim px + hedef MB altına OTOMATİK sıkıştırır. Hedefe
// ulaşana kadar önce kaliteyi sonra boyutu kademeli düşürür; böylece kullanıcı hiçbir
// zaman "dosya çok büyük" hatası almaz. Native'de (canvas yok) blob aynen döner.
async function compressImageBlob(
  blob: Blob,
  maxDim = 1600,
  quality = 0.82,
  maxBytes = MAX_IMAGE_BYTES
): Promise<{ blob: Blob; contentType: string }> {
  try {
    if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
      return { blob, contentType: blob.type || "image/jpeg" };
    }
    const bitmap = await createImageBitmap(blob);
    let dim = maxDim;
    let q = quality;
    let best: Blob | null = null;
    // En fazla 6 deneme: hedef altına inince dur. Önce kalite (0.82->0.5), sonra
    // boyut (%20 küçült) düşer. Kod pratikte 2-3 denemede biter.
    for (let i = 0; i < 6; i++) {
      const out = await renderJpeg(bitmap, dim, q);
      if (out && out.size > 0) {
        best = out;
        if (out.size <= maxBytes) break;
      }
      if (q > 0.5) q = Math.max(0.5, q - 0.12);
      else dim = Math.round(dim * 0.8);
    }
    if (best && best.size > 0) return { blob: best, contentType: "image/jpeg" };
  } catch (e) {
    console.warn("Görsel sıkıştırma atlandı:", (e as Error)?.message);
  }
  return { blob, contentType: blob.type || "image/jpeg" };
}

// Görseli Supabase storage'a yükler ve public URL döndürür. Web (blob:/data:) ve
// native (file:) URI'lerini destekler. Zaten yüklü http(s) URL'leri aynen döner.
export async function uploadListingImage(uri: string, userId: string) {
  if (!supabase || !uuidPattern.test(userId) || !uri) return uri;
  // Zaten uzak bir URL ise (ör. Supabase public URL veya stok görsel) tekrar yükleme.
  if (/^https?:\/\//i.test(uri)) return uri;

  const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const isVideo = Boolean(ALLOWED_VIDEO_TYPES[extension]);
  let contentType = ALLOWED_IMAGE_TYPES[extension] ?? ALLOWED_VIDEO_TYPES[extension] ?? "image/jpeg";

  let response: Response;
  try {
    response = await fetch(uri);
  } catch (e) {
    console.warn("Görsel okunamadı:", (e as Error)?.message);
    return uri;
  }
  let body = await response.blob();

  // Görselleri (video değil) hedef MB altına OTOMATİK sıkıştır/ölçekle.
  let ext = extension;
  if (!isVideo) {
    const compressed = await compressImageBlob(body, 1600, 0.82, MAX_IMAGE_BYTES);
    body = compressed.blob;
    contentType = compressed.contentType;
    if (contentType === "image/jpeg") ext = "jpg";
  }

  // Video sıkıştırılamadığı için hard limiti aşarsa reddet. Görsel ise sıkıştırma
  // zaten en aza indirdi; nadiren limit üstü kalırsa yine de yüklemeyi dener
  // (kullanıcıya "çok büyük" hatası çıkarmamak için).
  if (isVideo && body.size > MAX_MEDIA_BYTES) {
    console.warn(`Video çok büyük (${Math.round(body.size / 1024 / 1024)}MB > ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)}MB)`);
    return uri;
  }

  const path = `${userId}/${makeUuid()}.${ext}`;
  const { error } = await supabase.storage.from("listing-images").upload(path, body, { contentType, upsert: false });
  if (error) {
    console.warn("Supabase listing image upload failed", error);
    return uri;
  }
  return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
}

export async function uploadProfileAvatar(uri: string, userId: string) {
  if (!supabase || !uuidPattern.test(userId) || !uri) return uri;
  // Zaten uzak URL ise tekrar yükleme (web blob:/data: ve native file: desteklenir).
  if (/^https?:\/\//i.test(uri)) return uri;

  let response: Response;
  try {
    response = await fetch(uri);
  } catch (e) {
    console.warn("Avatar okunamadı:", (e as Error)?.message);
    return uri;
  }
  // Avatar için 512px yeterli; hedef MB altına otomatik sıkıştır.
  const compressed = await compressImageBlob(await response.blob(), 512, 0.85, MAX_IMAGE_BYTES);
  const body = compressed.blob;
  const path = `${userId}/avatar-${makeUuid()}.jpg`;
  const { error } = await supabase.storage.from("profile-avatars").upload(path, body, {
    contentType: compressed.contentType,
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
      province_id: listing.provinceId ?? null,
      district_id: listing.districtId ?? null,
      neighborhood_id: listing.neighborhoodId ?? null,
      address_visibility: listing.addressVisibility ?? "neighborhood",
      location_note: listing.locationNote ?? null,
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
  const payload: Record<string, unknown> = {
    id: message.id,
    conversation_id: message.conversationId,
    listing_id: message.listingId,
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    body: message.body,
    read: message.read
  };
  // Ek alanlarini yalnizca ek varsa gonder (migration uygulanmamis ortamlarda
  // metin mesajlari etkilenmesin).
  if (message.attachmentUrl) {
    payload.attachment_url = message.attachmentUrl;
    payload.attachment_type = message.attachmentType ?? "image";
    if (message.attachmentName) payload.attachment_name = message.attachmentName;
  }
  const { error } = await supabase.from("messages").insert(payload);
  if (error) console.warn("Supabase message insert failed", error);
}

/**
 * Mesaj eki yukler (gorsel/video). Mevcut listing-images bucket'ini kullanir;
 * sikistirma + boyut siniri uploadListingImage ile ayni. Canli olmayan modda
 * (uuid olmayan userId) yerel uri'yi aynen dondurur, boylece onizleme calisir.
 */
export async function uploadMessageAttachment(uri: string, userId: string) {
  return uploadListingImage(uri, userId);
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


