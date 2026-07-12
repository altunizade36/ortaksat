import { Platform } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { supabase } from "@/lib/supabase";
import type { CategorySuggestion, Conversation, Lead, Listing, LocationSuggestion, Message, ModerationStatus, Notification, Partnership, Report, Review, Sale, SuggestionStatus, User } from "@/lib/types";

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
export async function updateUserRoleLive(userId: string, role: string): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) { console.warn("User role update failed", error); return false; }
  return true;
}

/** Kullanici durumunu gunceller (active/suspended/deleted; yalniz admin). */
export async function updateUserStatusLive(userId: string, status: string): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
  if (error) { console.warn("User status update failed", error); return false; }
  return true;
}

/** Kullanici dogrulama rozetini (telefon/kimlik) admin manuel gunceller. */
export async function updateUserVerificationLive(userId: string, field: "verifiedPhone" | "verifiedIdentity", value: boolean): Promise<boolean> {
  if (!supabase) return true;
  const column = field === "verifiedPhone" ? "verified_phone" : "verified_identity";
  const { error } = await supabase.from("profiles").update({ [column]: value }).eq("id", userId);
  if (error) { console.warn("User verification update failed", error); return false; }
  return true;
}

/** Referans linki tiklamasini kaydeder (anonim; RLS public insert). */
export async function logReferralClick(listingId: string | undefined, partnershipId: string | undefined, refCode: string | undefined) {
  if (!supabase || !partnershipId) return;
  const { error } = await supabase.from("referral_clicks").insert({ listing_id: listingId ?? null, partnership_id: partnershipId, ref_code: refCode ?? null });
  if (error) console.warn("Referral click log failed", error);
}

/** Mağaza takibi (follows). follower_count trigger ile güncellenir. */
export async function followSellerLive(sellerId: string): Promise<boolean> {
  if (!supabase) return true;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { error } = await supabase.from("follows").insert({ follower_id: auth.user.id, seller_id: sellerId });
  return !error;
}
export async function unfollowSellerLive(sellerId: string): Promise<boolean> {
  if (!supabase) return true;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { error } = await supabase.from("follows").delete().eq("follower_id", auth.user.id).eq("seller_id", sellerId);
  return !error;
}
export async function loadMyFollowsLive(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("follows").select("seller_id").eq("follower_id", userId);
  return ((data ?? []) as Array<{ seller_id: string }>).map((r) => r.seller_id);
}

/** Ortagin ortakliklarinin tiklama sayilarini dondurur (partnershipId -> adet). */
export async function loadClickCounts(partnershipIds: string[]): Promise<Record<string, number>> {
  if (!supabase || partnershipIds.length === 0) return {};
  const { data, error } = await supabase.from("referral_clicks").select("partnership_id").in("partnership_id", partnershipIds).limit(5000);
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const r of data as Array<{ partnership_id: string }>) out[r.partnership_id] = (out[r.partnership_id] ?? 0) + 1;
  return out;
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
export async function savePreferencesLive(userId: string, preferences: Record<string, boolean | string | number>): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("profiles").update({ preferences }).eq("id", userId);
  if (error) { console.warn("Preferences update failed", error); return false; }
  return true;
}

/** Kullanicinin e-posta bildirim tercihini gunceller (KVKK: kolay opt-out). */
export async function saveEmailNotificationsLive(userId: string, enabled: boolean): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("profiles").update({ email_notifications: enabled }).eq("id", userId);
  if (error) { console.warn("Email notifications update failed", error); return false; }
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
export async function changePasswordLive(newPassword: string, currentPassword?: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Canlı bağlantı yok." };
  // Supabase "secure password change" AÇIK: mevcut şifre GEREKLİ. supabase-js
  // updateUser bunu iletmediği için GoTrue PUT /user'a current_password ile
  // doğrudan istek atıyoruz (aktif oturumun token'ıyla).
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: "Oturum bulunamadı. Lütfen tekrar giriş yap." };
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Yedek: eski akış (mevcut şifre gerektirmiyorsa çalışır).
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? { ok: false, error: translatePwError(error.message) } : { ok: true };
  }
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: anon, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword, current_password: currentPassword })
    });
    if (res.ok) {
      // Yeni parola sonrası oturumu tazele (mevcut token geçerli kalır ama temiz olsun).
      await supabase.auth.refreshSession().catch(() => undefined);
      return { ok: true };
    }
    const body = (await res.json().catch(() => ({}))) as { msg?: string; error_code?: string; message?: string };
    return { ok: false, error: translatePwError(body.error_code || body.msg || body.message || "") };
  } catch {
    return { ok: false, error: "Bağlantı hatası. Lütfen tekrar dene." };
  }
}

function translatePwError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("current_password") || m.includes("current password")) return "Mevcut şifren hatalı.";
  if (m.includes("should be different") || m.includes("different from the old")) return "Yeni şifre mevcut şifreden farklı olmalı.";
  if (m.includes("weak") || m.includes("at least")) return "Yeni şifre yeterince güçlü değil.";
  if (m.includes("reauth") || m.includes("nonce")) return "Güvenlik doğrulaması gerekli. Lütfen çıkış yapıp tekrar giriş yap.";
  return msg || "Şifre güncellenemedi.";
}

/** Admin: birden cok kullaniciya ayni bildirimi ekler (duyuru). */
export async function insertBulkNotifications(rows: Array<{ id: string; userId: string; type: string; title: string; body: string }>) {
  if (!supabase || rows.length === 0) return;
  const payload = rows.map((r) => ({ id: r.id, user_id: r.userId, type: r.type, title: r.title, body: r.body, read: false }));
  const { error } = await supabase.from("notifications").insert(payload);
  if (error) console.warn("Bulk notification insert failed", error);
}

/** Ilani one cikar/geri al (admin; RLS uygular). */
export async function updateListingFeaturedLive(listingId: string, featured: boolean): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("listings").update({ featured }).eq("id", listingId);
  if (error) { console.warn("Listing featured update failed", error); return false; }
  return true;
}

/** Ilani kalici siler (sahibi veya admin; RLS uygular). Iliskili kayitlar FK cascade ile temizlenir. */
export async function deleteListingLive(listingId: string): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("listings").delete().eq("id", listingId);
  if (error) { console.warn("Listing delete failed", error); return false; }
  return true;
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

/** Admin panelden gizlenen kategori key'lerini getirir (gezinme yüzeylerinden gizlenir). */
export async function fetchHiddenCategories(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("hidden_categories").select("category_key");
  if (error) { console.warn("Hidden categories fetch failed", error); return []; }
  return (data ?? []).map((r) => r.category_key as string);
}
/** Bir kategoriyi gizle (hidden=true) ya da göster (hidden=false). Admin. */
export async function setHiddenCategoryLive(key: string, hidden: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = hidden
    ? (await supabase.from("hidden_categories").upsert({ category_key: key }, { onConflict: "category_key" }))
    : (await supabase.from("hidden_categories").delete().eq("category_key", key));
  if (error) console.warn("Hidden category update failed", error);
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

export async function insertListing(listing: Listing): Promise<boolean> {
  if (!supabase) return true;

  const { error } = await supabase.from("listings").insert({
    id: listing.id,
    owner_id: listing.ownerId,
    title: listing.title,
    slug: listing.slug,
    description: listing.description,
    price: listing.price,
    commission_type: listing.commissionType,
    commission_value: listing.commissionValue,
    commission_tiers: listing.commissionTiers && listing.commissionTiers.length ? listing.commissionTiers : null,
    bonus_amount: listing.bonusAmount ?? null,
    bonus_quota: listing.bonusQuota ?? null,
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
    attribution_window_days: listing.attributionWindowDays ?? 30,
    partner_rules: listing.partnerRules,
    delivery_note: listing.deliveryNote,
    contact_method: listing.contactMethod,
    sales_pitch: listing.salesPitch,
    share_templates: listing.shareTemplates ?? null,
    ad_assets: listing.adAssets ?? [],
    tags: listing.tags,
    attributes: listing.attributes ?? {}
  });

  if (error) {
    console.warn("Supabase listing insert failed", error);
    return false;
  }

  // Görsel ikincil: ilan yazıldıysa görsel hatası tüm işlemi başarısız saymaz.
  if (listing.image) {
    const imageError = (await supabase.from("listing_images").insert({
      listing_id: listing.id,
      url: listing.image,
      sort_order: 0
    })).error;
    if (imageError) console.warn("Supabase listing image insert failed", imageError);
  }
  return true;
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
  let ext = extension;

  // NATIVE görsel: web'deki canvas sıkıştırması native'de çalışmaz (document yok),
  // bu yüzden yükleme öncesi expo-image-manipulator ile 1600px'e ölçekle + sıkıştır.
  // Web'de aşağıdaki compressImageBlob (canvas) yolu kullanılır.
  let workUri = uri;
  if (!isVideo && Platform.OS !== "web") {
    try {
      const manip = await manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.8, format: SaveFormat.JPEG });
      workUri = manip.uri;
      contentType = "image/jpeg";
      ext = "jpg";
    } catch (e) {
      console.warn("Görsel ölçeklenemedi, orijinal yüklenecek:", (e as Error)?.message);
    }
  }

  let response: Response;
  try {
    response = await fetch(workUri);
  } catch (e) {
    console.warn("Görsel okunamadı:", (e as Error)?.message);
    return uri;
  }
  let body = await response.blob();

  // Görselleri (video değil) hedef MB altına OTOMATİK sıkıştır/ölçekle (web: canvas;
  // native: yukarıda zaten ölçeklendi, burada boyut yine yüksekse ikinci geçiş).
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

// Ortaklık katılımı SUNUCU-doğrulamalı RPC üzerinden: invite kodu SQL'de doğrulanır,
// onay modu 'pending' yapılır, reddedilen yeniden açılır. Doğrudan insert/update RLS'e
// takılan (ortak UPDATE yapamaz) reopen'ı da çözer. Yeni + reopen için tek yol.
export async function partnerJoinLive(partnership: Partnership, inviteCode?: string): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.rpc("partner_join", {
    p_partnership_id: partnership.id,
    p_listing_id: partnership.listingId,
    p_ref_code: partnership.refCode,
    p_invite_code: inviteCode ?? null,
    p_note: partnership.note ?? "",
    p_share_channel: partnership.shareChannel ?? "",
    p_audience: partnership.audience ?? "",
    p_platform_handle: partnership.platformHandle ?? "",
    p_reach: partnership.reachEstimate ?? 0
  });
  if (error) { console.warn("Supabase partner_join RPC failed", error); return false; }
  return true;
}

// Toplu ödeme kaydı: bir ortağın (ops. tek ilan) borçlu komisyonlarını tek işlemde
// seller_paid yapar + payout kaydı oluşturur (record_payout RPC). Platform para tutmaz.
export async function recordPayoutLive(partnerId: string, listingId: string | null): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.rpc("record_payout", { p_partner_id: partnerId, p_listing_id: listingId, p_note: null });
  if (error) { console.warn("Supabase record_payout RPC failed", error); return false; }
  return true;
}

// insertPartnership KALDIRILDI: ortaklık katılımı artık yalnız partner_join RPC ile
// (sunucu-doğrulamalı). Doğrudan, sertleştirilmemiş insert yolu bırakılmadı.

// Herkese açık ortak liderlik tablosu (RLS'ten bağımsız agregat view). Boş dönerse
// (cold-start / önizleme) çağıran istemci-agregasyonuna düşer.
export type PublicLeaderRow = { partnerId: string; fullName: string; verifiedIdentity: boolean; confirmedSales: number; paidEarned: number };
export async function loadPartnerLeaderboardLive(limit = 10): Promise<PublicLeaderRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("partner_leaderboard_public")
    .select("partner_id, full_name, verified_identity, confirmed_sales, paid_earned")
    .order("confirmed_sales", { ascending: false })
    .limit(limit);
  if (error) { console.warn("Supabase leaderboard load failed", error); return []; }
  return (data ?? []).map((r) => ({
    partnerId: String(r.partner_id),
    fullName: String(r.full_name ?? ""),
    verifiedIdentity: Boolean(r.verified_identity),
    confirmedSales: Number(r.confirmed_sales ?? 0),
    paidEarned: Number(r.paid_earned ?? 0)
  }));
}

// Per-ortak komisyon override (satıcı = ilan sahibi; partnerships UPDATE RLS'i sahibe izinli).
export async function setPartnershipCommissionLive(partnershipId: string, type: "rate" | "fixed" | null, value: number | null): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("partnerships").update({
    commission_override_type: type,
    commission_override_value: value
  }).eq("id", partnershipId);
  if (error) { console.warn("Supabase commission override update failed", error); return false; }
  return true;
}

export async function updatePartnershipStatus(partnership: Partnership): Promise<boolean> {
  if (!supabase) return true;
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
  if (error) { console.warn("Supabase partnership update failed", error); return false; }
  return true;
}

export async function insertLead(lead: Lead): Promise<boolean> {
  if (!supabase) return true;
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
  if (error) { console.warn("Supabase lead insert failed", error); return false; }
  return true;
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

// Atomik: order + commission + stok düşümü + lead-dönüşümü TEK RPC/transaction'da.
// Eskiden 3 ayrı yazımdı; commission başarısız olunca yetim order + yanlış stok kalıyordu.
// RPC ayrıca sahiplik/stok/aktiflik doğrulamasını sunucuda yapar. `listing` param'ı artık
// kullanılmıyor (RPC DB'den okur) ama çağrı yerleri değişmesin diye korunuyor.
export async function insertSaleFromLead(sale: Sale, _listing: Listing): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.rpc("record_sale", {
    p_commission_id: sale.id,
    p_order_id: makeUuid(),
    p_listing_id: sale.listingId,
    p_partnership_id: sale.partnershipId,
    p_lead_id: sale.leadId ?? null,
    p_commission_amount: sale.commissionAmount,
    p_sale_amount: sale.amount,
    p_quantity: sale.quantity ?? 1,
    p_buyer_name: sale.buyerName ?? null,
    p_delivery_status: sale.deliveryStatus ?? "confirmed",
    p_return_until: sale.returnUntil ?? null,
    p_status: sale.status,
    p_approved_at: sale.approvedAt ?? null,
    p_payout_note: sale.payoutNote ?? null
  });
  if (error) { console.warn("Supabase record_sale RPC failed", error); return false; }
  return true;
}

export async function updateSaleStatusLive(sale: Sale): Promise<boolean> {
  if (!supabase) return true;
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
  if (error) { console.warn("Supabase commission update failed", error); return false; }
  return true;
}

export async function updateListingStatusLive(listing: Listing): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("listings").update({ status: listing.status }).eq("id", listing.id);
  if (error) { console.warn("Supabase listing status update failed", error); return false; }
  return true;
}

/** Satır-içi hızlı düzenleme: yalnız stok ve/veya fiyat günceller (RLS: sahip). */
export async function updateListingStockPriceLive(id: string, patch: { stockCount?: number; price?: number }): Promise<boolean> {
  if (!supabase) return true;
  const payload: Record<string, number> = {};
  if (typeof patch.stockCount === "number") payload.stock_count = patch.stockCount;
  if (typeof patch.price === "number") payload.price = patch.price;
  if (Object.keys(payload).length === 0) return true;
  const { error } = await supabase.from("listings").update(payload).eq("id", id);
  if (error) console.warn("Supabase listing stock/price update failed", error);
  return !error;
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
      commission_tiers: listing.commissionTiers && listing.commissionTiers.length ? listing.commissionTiers : null,
      bonus_amount: listing.bonusAmount ?? null,
      bonus_quota: listing.bonusQuota ?? null,
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
      attribution_window_days: listing.attributionWindowDays ?? 30,
      partner_rules: listing.partnerRules,
      delivery_note: listing.deliveryNote,
      contact_method: listing.contactMethod,
      sales_pitch: listing.salesPitch,
      share_templates: listing.shareTemplates ?? null,
      ad_assets: listing.adAssets ?? [],
      tags: listing.tags,
      attributes: listing.attributes ?? {}
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

export async function insertFavorite(listingId: string, userId: string, id: string, savedPrice?: number) {
  if (!supabase) return;
  const { error } = await supabase.from("favorites").insert({ id, listing_id: listingId, user_id: userId, saved_price: savedPrice ?? null });
  if (error) console.warn("Supabase favorite insert failed", error);
}

export async function deleteFavorite(listingId: string, userId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("favorites").delete().eq("listing_id", listingId).eq("user_id", userId);
  if (error) console.warn("Supabase favorite delete failed", error);
}

export async function insertReview(review: Review): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("reviews").insert({
    id: review.id,
    listing_id: review.listingId,
    reviewer_id: review.reviewerId,
    rating: review.rating,
    comment: review.comment,
    type: review.type ?? "product",
    // Karşılıklı satış puanlaması: hangi satış + kim puanlandı — çift-yorum
    // engeli ve alınan-puan/güven hesabı yeniden yüklemeden sonra da çalışsın.
    sale_id: review.saleId ?? null,
    reviewed_user_id: review.reviewedUserId ?? null
  });
  if (error) { console.warn("Supabase review insert failed", error); return false; }
  return true;
}

// Bir kullanıcı HAKKINDA yazılmış (aldığı) yorumları getir — mağaza/profil
// sayfasında ziyaretçilere gösterilir. reviews SELECT politikası herkese açık.
export async function fetchReviewsForUser(userId: string): Promise<Review[]> {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("reviewed_user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.warn("Supabase fetch user reviews failed", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    saleId: row.sale_id ?? undefined,
    reviewerId: row.reviewer_id,
    reviewedUserId: row.reviewed_user_id ?? undefined,
    rating: row.rating,
    comment: row.comment,
    type: row.type ?? "product",
    createdAt: (row.created_at ?? "").slice(0, 10),
    sellerReply: row.seller_reply ?? undefined,
    sellerReplyAt: row.seller_reply_at ?? undefined,
    helpfulCount: Number(row.helpful_count ?? 0)
  }));
}

// Satıcı yorumuna yanıt yazar/günceller (RPC: yalnız yorumun hakkında olduğu kişi).
export async function replyToReviewLive(reviewId: string, reply: string): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.rpc("reply_to_review", { p_review_id: reviewId, p_reply: reply });
  if (error) { console.warn("reply_to_review failed", error); return false; }
  return true;
}

// "Faydalı" oyunu aç/kapat (RPC toggle); güncel sayacı döndürür (null=hata).
export async function toggleReviewHelpfulLive(reviewId: string): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("toggle_review_helpful", { p_review_id: reviewId });
  if (error) { console.warn("toggle_review_helpful failed", error); return null; }
  return Number(data ?? 0);
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

export async function insertMessage(message: Message): Promise<boolean> {
  if (!supabase) return true;
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
  if (error) { console.warn("Supabase message insert failed", error); return false; }
  return true;
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
    read: notification.read,
    // Client kaynaklı bildirimlerde metadata varsa koru; yoksa DB default '{}' uygular.
    ...(notification.metadata ? { metadata: notification.metadata } : {})
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

/**
 * Hassas işlem öncesi yeniden kimlik doğrulama: mevcut oturumun e-postası ile
 * girilen şifreyi doğrular. Hesap silme gibi geri alınması zor işlemlerde kullanılır.
 */
export async function reauthenticateLive(password: string): Promise<boolean> {
  if (!supabase || !password) return false;
  try {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email;
    if (!email) return false;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  } catch {
    return false;
  }
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


// ---- Kategori / konum önerileri (kalıcı) ---------------------------------
// RLS: kullanıcı kendi önerisini insert eder (user_id = auth.uid()); durum
// güncellemesini yalnız admin yapabilir (is_admin). Tablolar 20260630120000
// migration'ında tanımlı (category_suggestions / location_suggestions).

export async function insertCategorySuggestion(s: CategorySuggestion): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("category_suggestions").insert({
    id: s.id,
    user_id: s.userId,
    listing_id: s.listingId ?? null,
    suggested_path: s.suggestedPath,
    note: s.note ?? null,
    status: s.status
  });
  if (error) { console.warn("Supabase category suggestion insert failed", error); return false; }
  return true;
}

export async function insertLocationSuggestion(s: LocationSuggestion): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("location_suggestions").insert({
    id: s.id,
    user_id: s.userId,
    province_id: s.provinceId ?? null,
    district_id: s.districtId ?? null,
    suggested_name: s.suggestedName,
    type: s.type,
    note: s.note ?? null,
    status: s.status
  });
  if (error) { console.warn("Supabase location suggestion insert failed", error); return false; }
  return true;
}

export async function updateCategorySuggestionStatusLive(id: string, status: SuggestionStatus, reviewerId?: string): Promise<boolean> {
  if (!supabase) return true;
  const now = new Date().toISOString();
  const { error } = await supabase.from("category_suggestions").update({ status, reviewed_by: reviewerId ?? null, reviewed_at: now, updated_at: now }).eq("id", id);
  if (error) { console.warn("Supabase category suggestion update failed", error); return false; }
  return true;
}

export async function updateLocationSuggestionStatusLive(id: string, status: SuggestionStatus, reviewerId?: string): Promise<boolean> {
  if (!supabase) return true;
  const now = new Date().toISOString();
  const { error } = await supabase.from("location_suggestions").update({ status, reviewed_by: reviewerId ?? null, reviewed_at: now, updated_at: now }).eq("id", id);
  if (error) { console.warn("Supabase location suggestion update failed", error); return false; }
  return true;
}
