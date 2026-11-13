import { validateListingTitle } from "@/lib/listing-title";
import { clearOAuthConsent, prepareOAuthConsent, recordExplicitOAuthConsent } from "@/lib/oauth-consent";
import { hasProfilePhoto } from "@/lib/profile-photo";
﻿import { createContext, PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cardImageUrl } from "@/lib/image-url";
import { Image as ExpoImage } from "expo-image";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { showToast } from "@/lib/toast";

import {
  conversations as initialConversations,
  currentUserId,
  favorites as initialFavorites,
  leads as initialLeads,
  listings as initialListings,
  messages as initialMessages,
  notifications as initialNotifications,
  orders as initialOrders,
  partnerships as initialPartnerships,
  reviews as initialReviews,
  sales as initialSales,
  users as initialUsers
} from "@/data/mock-data";
import { logActivity } from "@/lib/audit";
import { getInitialAuthUrl, handleSupabaseAuthUrl, subscribeToAuthUrls } from "@/lib/auth-links";
import { promptLogin } from "@/lib/auth-prompt";
import { registerFavoriteToggle, syncFavorites } from "@/lib/favorites-cache";
import { haptic } from "@/lib/haptics";
import { metaTrack } from "@/lib/meta-pixel";
import { syncSavedForUser } from "@/lib/saved-searches";
import { effectiveCommissionAmount, listingInviteCode, moneyIn, msgStamp } from "@/lib/format";
import { noteThreadActivity, noteThreadHasMessages } from "@/lib/inbox-model";
import { scanTextLocal } from "@/lib/moderation";
import {
  deleteFavorite,
  ensureProfile,
  createSupportTicketLive,
  followSellerLive,
  unfollowSellerLive,
  editReviewLive,
  deleteReviewLive,
  blockUserLive,
  unblockUserLive,
  fetchBlockedUsers,
  createOfferLive,
  fetchOffersLive,
  fetchOffersResultLive,
  offerSellerRespondLive,
  offerBuyerActionLive,
  loadMyFollowsLive,
  insertFavorite,
  updateFavoriteCollection,
  insertLead,
  insertListing,
  insertListingResult,
  insertConversation,
  insertMessageResult,
  messageSendBlockedReason,
  insertNotification,
  partnerJoinLive,
  insertReport,
  insertReview,
  insertSaleFromLead,
  setBuyerConfirmToken,
  isLiveUser,
  makeUuid,
  markConversationReadLive,
  markNotificationReadLive,
  markAllNotificationsReadLive,
  updateLeadStatusLive,
  updateListingLive,
  updateListingStatusLive,
  updateListingStockPriceLive,
  updateListingInventoryLive,
  updatePartnershipStatus,
  leavePartnershipLive,
  setPartnershipCommissionLive,
  updateReportStatusLive,
  updateProfileLive,
  mergePreferencesLive,
  saveEmailNotificationsLive,
  recordLegalConsentLive,
  requestAccountDeletionLive,
  cancelAccountDeletionLive,
  removeListingLive,
  updateListingFeaturedLive,
  insertBulkNotifications,
  updateAnnouncementLive,
  saveBlogPostLive,
  deleteBlogPostLive,
  saveContentPageLive,
  saveSeoSettingLive,
  saveCategoryLive,
  deleteCategoryLive,
  fetchHiddenCategories,
  setHiddenCategoryLive,
  bulkInsertCategoriesLive,
  updatePlatformSettingLive,
  updateUserRoleLive,
  updateUserStatusLive,
  updateUserVerificationLive,
  updateSaleStatusLive,
  recordPayoutLive,
  insertCategorySuggestion,
  insertLocationSuggestion,
  updateCategorySuggestionStatusLive,
  updateLocationSuggestionStatusLive
} from "@/lib/live-service";
import { rateLimit, rateLimitSync } from "@/lib/rate-limit";
import { unregisterPush } from "@/lib/push";
import { supabase, isSupabaseConfigured, readStoredAuthUser } from "@/lib/supabase";
import { fetchListingsByIds, fetchPublicProfiles, fetchUserNotifications, loadAccountSnapshot, loadAdminSnapshot, loadBlogPosts, loadCategories, loadContentPages, loadMarketplacePage, loadMarketplaceSnapshot, loadOwnListings, loadPlatformSettings, loadSeoSettings, loadSuggestions, parseNotifMeta, type DbBlogPost, type DbContentPage, type DbSeoSetting, type ExtraCategory } from "@/lib/supabase-data";
import { categoryTree as baseCategoryTree, setHiddenCategories as setHiddenCategoriesModule, type CategoryNode } from "@/lib/category-tree";
import { displayText, repairTurkishText } from "@/lib/text";
import { firstError, isValidEmail, validateSignIn, validateSignUp } from "@/lib/validation";
import type {
  Conversation,
  Favorite,
  Lead,
  Offer,
  CategorySuggestion,
  LeadStatus,
  Listing,
  LocationSuggestion,
  Message,
  Notification,
  NotificationMeta,
  Order,
  Partnership,
  PlatformSettings,
  Report,
  Review,
  Sale,
  SaleStatus,
  SuggestionStatus,
  User,
  UserRole
} from "@/lib/types";

type NewListingInput = Pick<
  Listing,
  | "title"
  | "externalId"
  | "description"
  | "salesPitch"
  | "shareTemplates"
  | "adAssets"
  | "tags"
  | "price"
  | "currency"
  | "commissionType"
  | "commissionValue"
  | "commissionTiers"
  | "bonusAmount"
  | "bonusQuota"
  | "category"
  | "location"
  | "provinceId"
  | "districtId"
  | "neighborhoodId"
  | "addressVisibility"
  | "locationNote"
  | "image"
  | "stockCount"
  | "minPartnerRating"
  | "commissionDueDays"
  | "returnWindowDays"
  | "attributionWindowDays"
  | "partnerRules"
  | "deliveryNote"
  | "contactMethod"
  | "partnershipMode"
  | "attributes"
>;

type PartnershipApplicationInput = {
  shareChannel: string;
  audience: string;
  platformHandle: string;
  reachEstimate: number;
  note: string;
  inviteCode: string;
};

type SaleFromLeadInput = {
  amount: number;
  quantity: number;
  deliveryStatus: Order["status"];
};

const LEGAL_CONSENT_VERSION = "2026-06-11";
const LEGAL_DOCUMENT_TYPES = ["privacy", "terms", "kvkk", "seller_rules"] as const;

// Auth e-postalarındaki (kayıt / şifre sıfırlama / kod tekrar) ve OAuth'taki dönüş adresi — TEK KAYNAK.
// KRİTİK: native'de `window` HER ZAMAN tanımlıdır (RN `global.window = global`) ama yayın
// derlemesinde `window.location` YOKTUR → `typeof window !== "undefined"` kontrolüyle
// `window.location.origin` okumak kayıt ve şifre sıfırlamayı native'de ÇÖKERTİYORDU
// ("Bağlantı hatası"). Web'de site adresi, native'de uygulama şeması döner.
function authRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) return `${window.location.origin}/auth`;
  // Expo Go deneme uygulaması `ortaksat://` şemasını TANIMAZ (Google dönüşü tarayıcıda boş sayfada kalıyor,
  // cihazda OrtakSat uygulaması da kuruluysa oturum ORAYA gidiyordu). Orada dönüş adresi deneme uygulamasının
  // kendi adresidir (exp://<bilgisayar>:8081/--/auth); bu adres Supabase yönlendirme izin listesinde TEK TEK
  // tanımlıdır (joker yok — başka bir adrese oturum taşınamaz).
  const host = expoGoHost();
  if (host) return `exp://${host}/--/auth`;
  return "ortaksat://auth";
}

// Google gibi tarayıcıdan dönen girişlerin dönüş adresi.
// KRİTİK (2026-11-14, canlıda ölçüldü): giriş servisi SAYISAL yerel ağ adresli dönüşü (exp://192.168.x.x…)
// izin listesinde olsa bile REDDEDER ve kullanıcıyı siteye yollar; yalnız 127.0.0.1 (emülatör) ile ad
// biçimli adresleri kabul eder. iPhone'da giriş penceresi dönüşü yalnız şemaya ("exp") bakarak yakaladığı
// için adresin bilgisayarı göstermesi gerekmez → deneme uygulamasında sabit, ad biçimli adres kullanılır.
function oauthRedirectUrl(): string {
  const host = expoGoHost();
  if (host && Platform.OS === "ios" && !/^(127\.0\.0\.1|localhost)(:|$)/i.test(host)) return "exp://ortaksat-deneme/--/auth";
  return authRedirectUrl();
}

/**
 * Expo Go deneme uygulamasında çalışıyorsak geliştirme sunucusunun adresi ("192.168.1.3:8081"), değilse null.
 * DİKKAT: SDK 58 Expo Go'da `Constants.executionEnvironment` "bare" döner ("storeClient" DEĞİL) ve
 * `Linking.createURL` uygulama şemasını (ortaksat://) verir → ikisi de Expo Go'yu ayırt etmek için kullanılamaz
 * (2026-11-13, emülatörde ölçüldü). Güvenilir işaret `Constants.expoGoConfig`'tir.
 */
function expoGoHost(): string | null {
  if (Platform.OS === "web" || !Constants.expoGoConfig) return null;
  const host = Constants.expoConfig?.hostUri ?? (Constants.expoGoConfig as { debuggerHost?: string }).debuggerHost;
  return host ? host.split("?")[0].replace(/\/+$/, "") : null;
}

// Supabase/GoTrue İngilizce hata mesajlarını Türkçeye çevirir (site Türkçe).
function translateAuthError(msg?: string | null): string | undefined {
  if (!msg) return undefined;
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-posta veya şifre hatalı.";
  if (m.includes("email not confirmed")) return "E-posta adresin henüz doğrulanmadı. Gelen kutundaki 6 haneli kodu gir.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Bu e-posta ile zaten bir hesap var. Giriş yapabilirsin.";
  if (m.includes("password should be at least") || m.includes("password is too short")) return "Şifre çok kısa — en az 8 karakter olmalı.";
  if (m.includes("weak password") || m.includes("password should contain")) return "Şifre yeterince güçlü değil (büyük/küçük harf, rakam, özel karakter).";
  if (m.includes("unable to validate email") || m.includes("invalid format") || m.includes("email address") && m.includes("invalid")) return "Geçerli bir e-posta adresi gir.";
  if (m.includes("for security purposes") || m.includes("rate limit") || m.includes("too many requests")) return "Çok sık denendi. Lütfen biraz sonra tekrar dene.";
  if (m.includes("token has expired") || m.includes("otp_expired") || m.includes("invalid token") || m.includes("expired or is invalid")) return "Kod hatalı veya süresi dolmuş. Yeniden kod iste.";
  if (m.includes("different from the old password") || m.includes("same_password")) return "Yeni şifren eskisinden farklı olmalı.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Yeni kayıtlar şu anda geçici olarak kapalı.";
  if (m.includes("user not found")) return "Bu e-posta ile kayıt bulunamadı.";
  if (m.includes("email link is invalid") || m.includes("otp") && m.includes("invalid")) return "Doğrulama bağlantısı/kodu geçersiz. Yeniden dene.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Bağlantı sorunu. İnternetini kontrol edip tekrar dene.";
  if (m.includes("provider") && m.includes("not enabled")) return "Bu giriş yöntemi henüz etkin değil.";
  return msg; // bilinmeyen mesaj — olduğu gibi (nadiren İngilizce görünebilir)
}

type AppStore = {
  backendMode: "mock" | "supabase";
  authReady: boolean;
  authError?: string;
  currentUser: User;
  isAuthenticated: boolean;
  pendingVerifyEmail: string | null;
  clearPendingVerify: () => void;
  users: User[];
  listings: Listing[];
  marketplaceHasMore: boolean;
  marketplaceLoadingMore: boolean;
  marketplaceInitialLoading: boolean;
  accountLoaded: boolean;
  // İlk yükleme başarısız oldu (ağ/sunucu) → boş sayfa yerine "yeniden dene" göster.
  marketplaceLoadFailed: boolean;
  loadMoreMarketplace: () => void;
  refreshMarketplace: () => Promise<void>;
  // Kullanıcıya özel verileri (ortaklık/lead/satış/sipariş/yorum/favori/mesaj/bildirim) yeniden çeker.
  // Native pull-to-refresh için: refreshMarketplace yalnız katalog; bu ise hesap-özetini tazeler.
  refreshUserData: () => Promise<void>;
  retryMarketplace: () => Promise<void>;
  // Kritik akış yazımı canlıda başarısız olduğunda dolan görünür hata (UI Alert gösterir).
  syncError: string | null;
  clearSyncError: () => void;
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
  platformSettings: PlatformSettings;
  /** true = kalıcı yazıldı; false = yetki yok ya da yazım başarısız (iyimser değişiklik geri alınır). */
  updatePlatformSetting: (key: keyof PlatformSettings, value: boolean) => Promise<boolean>;
  setAnnouncement: (text: string, active: boolean) => Promise<boolean>;
  blogPosts: DbBlogPost[];
  contentPages: DbContentPage[];
  seoSettings: DbSeoSetting[];
  saveBlogPost: (post: DbBlogPost) => void;
  deleteBlogPost: (id: string) => void;
  saveContentPage: (page: DbContentPage) => void;
  saveSeoSetting: (setting: DbSeoSetting) => void;
  categoryTree: CategoryNode[];
  extraCategories: ExtraCategory[];
  saveCategory: (c: ExtraCategory) => void;
  deleteCategory: (id: string) => void;
  importCategories: (items: ExtraCategory[]) => number;
  hiddenCategories: string[];
  toggleHiddenCategory: (key: string) => void;
  emailVerified: boolean;
  isSuspended: boolean;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (input: { email: string; password: string; name: string; legalAccepted: boolean }) => Promise<boolean>;
  resetPasswordWithEmail: (email: string) => Promise<boolean>;
  updatePasswordWithEmail: (password: string) => Promise<boolean>;
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<boolean>;
  signInWithGoogle: (legalAccepted: boolean) => Promise<boolean>;
  signInWithApple: (legalAccepted: boolean) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  resendEmailCode: (email: string) => Promise<boolean>;
  /**
   * Bir auth eylemini (signInWithEmail, signUpWithEmail, …) çalıştırır ve o çağrının GERÇEK
   * hatasını sonuçla birlikte döndürür. Eylemlerin kendisi `boolean` dönmeye devam eder (mevcut
   * çağıranlar bozulmaz); hata metnine ihtiyacı olan ekran bunu kullanır.
   */
  authAttempt: (action: () => Promise<boolean>) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<boolean>;
  updateProfile: (input: Pick<User, "name" | "phone" | "avatar" | "bio"> & { expertiseCategories?: string[]; city?: string;username?:string;districtId?:number|null;website?:string;instagram?:string; cover?: string | null }) => Promise<boolean>;
  /** Yalnız DEĞİŞEN anahtarlar sunucuda birleştirilir (diğer tercihlere dokunulmaz); `null` değer anahtarı siler. */
  savePreferences: (preferences: Record<string, boolean | string | number | null>) => Promise<boolean>;
  setEmailNotifications: (enabled: boolean) => Promise<boolean>;
  reportListing: (listingId: string, reason: string, details?: string, options?:{id?:string;attachments?:string[]}) => Promise<boolean>;
  reportUser: (reportedUserId: string, reason: string, details?: string, options?:{id?:string;attachments?:string[]}) => Promise<boolean>;
  // Self-service doğrulama talebi: kullanıcı kendi hesabı için doğrulama ister →
  // admin moderasyon kuyruğunda "DOĞRULAMA TALEBİ" olarak görünür, admin onaylar.
  requestVerification: (note?: string) => Promise<boolean>;
  updateReportStatus: (reportId: string, status: Report["status"]) => Promise<boolean>;
  recordLegalConsent: (documentType: "privacy" | "terms" | "kvkk" | "seller_rules") => Promise<boolean>;
  createSupportTicket: (subject: string, message: string, options?: {id?:string;category?:string;attachments?:string[]}) => Promise<boolean>;
  requestAccountDeletion: (reason: string) => Promise<boolean>;
  /** Bekleyen hesap silme talebini iptal eder; başarılıysa hesap yeniden aktif olur. */
  cancelAccountDeletion: () => Promise<boolean>;
  createListing: (input: NewListingInput, statusOverride?: Listing["status"]) => Promise<Listing>;
  updateListing: (listingId: string, input: NewListingInput, publish?: boolean) => Promise<boolean>;
  createLead: (input: Omit<Lead, "id" | "createdAt" | "status">) => Lead | undefined;
  createReview: (listingId: string, rating: number, comment: string) => Promise<Review | undefined>;
  createSaleReview: (saleId: string, rating: number, comment: string, options?:{id?:string;experienceTags?:string[];mediaPaths?:string[]}) => Promise<Review | undefined>;
  editReview: (reviewId: string, rating: number, comment: string) => Promise<boolean>;
  deleteReview: (reviewId: string) => Promise<boolean>;
  reportReview: (review: Review, details?: string) => Promise<boolean>;
  canReviewSale: (saleId: string) => boolean;
  createSaleFromLead: (leadId: string, input?: Partial<SaleFromLeadInput>) => Sale | undefined;
  recordSaleForPartner: (partnershipId: string, input?: Partial<SaleFromLeadInput> & { buyerName?: string }) => Sale | undefined;
  joinListing: (listingId: string, input?: Partial<PartnershipApplicationInput>, fallbackListing?: Listing) => Promise<Partnership | undefined>;
  approvePartnership: (partnershipId: string) => Promise<boolean>;
  rejectPartnership: (partnershipId: string, reason?: string) => Promise<boolean>;
  endPartnership: (partnershipId: string, mode?: "blocked" | "cancelled") => Promise<boolean>;
  leavePartnership: (partnershipId: string) => Promise<boolean>;
  setPartnershipCommission: (partnershipId: string, type?: "rate" | "fixed", value?: number) => Promise<boolean>;
  toggleFavorite: (listingId: string) => void;
  setFavoriteCollection: (listingId: string, collection: string | null) => void;
  followedSellerIds: string[];
  isFollowing: (sellerId: string) => boolean;
  toggleFollow: (sellerId: string) => void;
  offers: Offer[];
  createOffer: (listingId: string, sellerId: string, amount: number, note?: string) => Promise<{ ok: boolean; error?: string }>;
  sellerRespondOffer: (offerId: string, action: "accepted" | "rejected" | "countered", counterAmount?: number) => Promise<boolean>;
  buyerOfferAction: (offerId: string, action: "withdrawn" | "accept_counter" | "reject_counter") => Promise<boolean>;
  blockedUserIds: string[];
  isUserBlocked: (userId: string) => boolean;
  blockUser: (userId: string,reason?:string) => Promise<boolean>;
  unblockUser: (userId: string) => Promise<boolean>;
  startConversation: (listingId: string, receiverId: string, body?: string, fallbackListing?: Listing) => Conversation | undefined;
  sendMessage: (listingId: string, receiverId: string, body: string) => void;
  sendConversationMessage: (conversationId: string, body: string, attachment?: { url: string; type: "image" | "file"; name?: string }) => boolean;
  retryMessage: (messageId: string) => void;
  markConversationRead: (conversationId: string) => void;
  markNotificationRead: (notificationId: string) => Promise<boolean>;
  /** Kullanıcının tüm okunmamış bildirimlerini TEK istekle okundu yapar; başarısızsa geri alır ve false döner. */
  markAllNotificationsRead: () => Promise<boolean>;
  refreshNotifications: () => Promise<void>;
  categorySuggestions: CategorySuggestion[];
  locationSuggestions: LocationSuggestion[];
  addCategorySuggestion: (input: { suggestedPath: string; note?: string; listingId?: string }) => void;
  addLocationSuggestion: (input: { provinceId?: number; districtId?: number; suggestedName: string; note?: string }) => void;
  setCategorySuggestionStatus: (id: string, status: SuggestionStatus) => Promise<boolean>;
  setLocationSuggestionStatus: (id: string, status: SuggestionStatus) => Promise<boolean>;
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  updateListingStatus: (listingId: string, status: Listing["status"]) => Promise<boolean>;
  updateListingInventory: (listingId: string, patch: { stockCount?: number; price?: number }) => void;
  setListingFeatured: (listingId: string, featured: boolean) => Promise<boolean>;
  /** Sunucu-otoriteli kaldırma (remove_listing RPC): geçmişi olmayan ilan SİLİNİR, geçmişi olan ARŞİVLENİR.
   *  true = kaldırıldı; hangisinin olduğu onOutcome ile bildirilir. false = yetki yok / yazım başarısız. */
  deleteListing: (listingId: string, onOutcome?: (outcome: "deleted" | "archived") => void) => Promise<boolean>;
  removeListing: (listingId: string) => Promise<boolean>;
  setUserRole: (userId: string, role: UserRole) => Promise<boolean>;
  setUserStatus: (userId: string, status: NonNullable<User["status"]>) => Promise<boolean>;
  setUserVerification: (userId: string, field: "verifiedPhone" | "verifiedIdentity", value: boolean) => Promise<boolean>;
  adminNotifyUser: (userId: string, title: string, body: string) => Promise<boolean>;
  adminBroadcast: (title: string, body: string) => void;
  updateSaleStatus: (saleId: string, status: SaleStatus, reason?: string) => Promise<boolean>;
  recordBatchPayout: (partnerId: string, listingId?: string) => void;
  findConversation: (id: string) => Conversation | undefined;
  findListing: (id: string) => Listing | undefined;
  findUser: (id: string) => User | undefined;
  findPartnership: (listingId: string, partnerId?: string) => Partnership | undefined;
  isFavorite: (listingId: string) => boolean;
};

/** En-iyi-çaba: kart küçük görsellerini disk önbelleğine indirir; hata sessizce yutulur. */
function prefetchListingImages(items: Listing[]): void {
  try {
    const urls = items.map((item) => cardImageUrl(item.imageUrl || item.image)).filter((url): url is string => typeof url === "string" && url.startsWith("http"));
    if (urls.length) void ExpoImage.prefetch(urls, "memory-disk").catch(() => {});
  } catch { /* görsel modülü yoksa atla */ }
}

// Uygulamada açılış önbelleği: son başarılı ilan listesinin ilk bölümü (herkese açık veri) cihazda tutulur.
const MARKETPLACE_CACHE_KEY = "ortaksat.marketplaceCache.v1";
const MARKETPLACE_CACHE_LISTINGS = 48;
const MARKETPLACE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const StoreContext = createContext<AppStore | null>(null);

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeRefCode(userId: string, listingId: string) {
  const seed = Math.floor(1000 + Math.random() * 9000);
  return `${userId.slice(0, 5).toUpperCase()}-${listingId.slice(0, 5).toUpperCase()}-${seed}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string, live: boolean) {
  return live ? makeUuid() : `${prefix}-${Date.now()}`;
}

// Alıcı satış-onay linki için tahmin edilemez token (Faz 2). URL-güvenli, ~38 karakter.
function makeConfirmToken() {
  return makeUuid().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
    .join("");
}

function userFromAuth(id: string, phone?: string | null, name?: string | null, avatar?: string | null): User {
  const displayName = name || phone || "OrtakSat kullanıcısı";

  return {
    id,
    name: displayName,
    phone: phone ?? "",
    avatar: hasProfilePhoto(avatar) ? avatar! : initials(displayName) || "OS",
    bio: "",
    verifiedPhone: Boolean(phone),
    verifiedIdentity: false,
    verifiedInstagram: false,
    rating: 0,
    listingCount: 0,
    successfulSales: 0,
    followerCount: 0,
    responseRate: 0,
    role: "user",
    expertiseCategories: []
  };
}

// incoming id'leri prev'i EZER (admin tam verisi mevcut kısmi veriyi gunceller).
function mergeById<T extends { id: string }>(prev: T[], incoming: T[]): T[] {
  const map = new Map(prev.map((x) => [x.id, x]));
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}

// Canlı modda oturum açılmadan gezerken kullanılan misafir kullanıcı.
const ANON_USER: User = {
  id: "anon",
  name: "Misafir",
  phone: "",
  avatar: "MS",
  bio: "",
  verifiedPhone: false,
  verifiedIdentity: false,
  rating: 0,
  listingCount: 0,
  successfulSales: 0,
  followerCount: 0,
  responseRate: 0
};

export function StoreProvider({ children }: PropsWithChildren) {
  const [backendMode, setBackendMode] = useState<"mock" | "supabase">("mock");
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authError, setAuthErrorState] = useState<string | undefined>();
  // Son auth hatasının ANLIK kopyası: `authError` state'i çağıranın closure'ında bir render
  // GERİDEN gelir (await sonrası eski değer okunur) → `authAttempt` gerçek hatayı buradan döndürür.
  const lastAuthErrorRef = useRef<string | undefined>(undefined);
  const setAuthError = useRef((value: string | undefined) => {
    lastAuthErrorRef.current = value;
    setAuthErrorState(value);
  }).current;
  // CANLI mod (Supabase ayarlı): hiçbir demo/mock veri yüklenmez — her şey gerçek
  // veriyle Supabase'den gelir. Yalnızca yerel önizlemede (Supabase yokken) demo veri.
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  // Kayıt olup henüz e-posta kodunu girmemiş kullanıcının e-postası (kod ekranı için).
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>(isSupabaseConfigured ? [] : initialUsers);
  const [listings, setListings] = useState<Listing[]>(isSupabaseConfigured ? [] : initialListings);
  const [partnerships, setPartnerships] = useState(isSupabaseConfigured ? [] : initialPartnerships);
  const [leads, setLeads] = useState(isSupabaseConfigured ? [] : initialLeads);
  const [sales, setSales] = useState(isSupabaseConfigured ? [] : initialSales);
  const [orders, setOrders] = useState(isSupabaseConfigured ? [] : initialOrders);
  const [reviews, setReviews] = useState(isSupabaseConfigured ? [] : initialReviews);
  const favoriteAccount = useRef(authUser?.id);
  const partnershipWrites=useRef(new Set<string>());
  favoriteAccount.current = authUser?.id;
  const notificationWrites = useRef(new Set<string>());
  // Tercih kayıtları: sunucuya SIRAYLA gider (yanıtlar sıra dışı gelip yerel durumu eski bir sonuçla
  // ezmesin); `preferenceWrites` = henüz yanıtı gelmemiş yamalar (sunucu sonucu uygulanırken üstüne bindirilir).
  const preferenceQueue = useRef<Promise<unknown>>(Promise.resolve());
  const preferenceWrites = useRef<Array<Record<string, boolean | string | number | null>>>([]);
  // Mesajlaşma: (ilan:alıcı) → bu oturumda açılan konuşma. `conversations` state'i bir sonraki
  // render'a kadar bayat olduğundan hızlı çift dokunuş İKİ konuşma açıyordu; ref anında görür.
  const pendingConversations = useRef(new Map<string, Conversation>());
  // konuşma id → sunucuya yazımı bekleyen söz (ilk mesaj konuşma satırından ÖNCE gitmesin).
  const conversationReady = useRef(new Map<string, Promise<string | null>>());
  // yerel konuşma id → sunucudaki mevcut konuşma id (aynı ilan+kişi için zaten varsa).
  const conversationAlias = useRef(new Map<string, string>());
  // Sunucuya yazıldığı DOĞRULANAN konuşma id'leri (yerel + sunucu id). Doğrulanmamış yerel konuşma,
  // yenilemede sunucu listesinde olmadığı için silinmez (bkz. mergeServerConversations).
  const confirmedConversations = useRef(new Set<string>());
  const favoriteWrites = useRef(new Set<string>());
  const [favorites, setFavorites] = useState(isSupabaseConfigured ? [] : initialFavorites);
  const [followedSellerIds, setFollowedSellerIds] = useState<string[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState(isSupabaseConfigured ? [] : initialConversations);
  const [messages, setMessages] = useState(isSupabaseConfigured ? [] : initialMessages);
  const [notifications, setNotifications] = useState(isSupabaseConfigured ? [] : initialNotifications);
  const [reports, setReports] = useState<Report[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    allowSignups: true,
    reviewBeforePublish: false,
    requireEmailVerification: false,
    maintenanceMode: false,
    announcement: "",
    announcementActive: false
  });
  // Katalog sayfalama (sunucu tarafli). mpOffsetRef = simdiye kadar cekilen
  // katalog ilan sayisi; hasMore = daha var mi; loadingMore = yukleme kilidi.
  const mpOffsetRef = useRef(0);
  // refreshMarketplace ile loadMore yarışını engelleyen kuşak sayacı: refresh sayacı artırır,
  // uçuştaki loadMore sonucu kuşak değiştiyse yok sayılır (offset kayması/boşluk önlenir).
  const mpGenRef = useRef(0);
  // Hesap-özeti hangi kullanıcı için yüklendi: aynı kullanıcı için (TOKEN_REFRESHED, çift
  // INITIAL_SESSION) 10 tabloyu YENİDEN yükleyip iyi veriyi ezmeyi önler.
  const loadedAccountUserRef = useRef<string | null>(null);
  const [marketplaceHasMore, setMarketplaceHasMore] = useState(isSupabaseConfigured);
  const [marketplaceLoadingMore, setMarketplaceLoadingMore] = useState(false);
  // İlk ilan yüklemesi sürerken skeleton göstermek için (yalnız canlı modda).
  const [marketplaceInitialLoading, setMarketplaceInitialLoading] = useState(isSupabaseConfigured);
  // Hesap-özeti (konuşmalar/mesajlar dahil) yüklendi mi? Chat/inbox 'yükleniyor' ile
  // 'gerçekten yok'u ayırt etsin (derin-link/yenilemede yanlış 'Konuşma bulunamadı' önlenir).
  const [accountLoaded, setAccountLoaded] = useState(!isSupabaseConfigured);
  // İlk yükleme başarısız (snapshot null / ağ hatası) → "yeniden dene" durumu.
  const [marketplaceLoadFailed, setMarketplaceLoadFailed] = useState(false);
  // Kritik akışlarda arka plan Supabase yazımı başarısız olursa kullanıcıya gösterilecek hata.
  const [syncError, setSyncError] = useState<string | null>(null);
  const [blogPosts, setBlogPosts] = useState<DbBlogPost[]>([]);
  const [contentPages, setContentPages] = useState<DbContentPage[]>([]);
  const [seoSettings, setSeoSettings] = useState<DbSeoSetting[]>([]);
  const [extraCategories, setExtraCategories] = useState<ExtraCategory[]>([]);
  const [hiddenCategories, setHiddenCategoriesState] = useState<string[]>([]);
  // Preview (no-Supabase) auth registry so register/login/logout work end-to-end in demo mode.
  const [mockAccounts, setMockAccounts] = useState<Record<string, { password: string; user: User }>>({});

  // Old conversation listings and buyer profiles need not be in the first catalogue page.
  // Hydrate only public fields, batch once per session, and never overwrite newer cached data.
  const conversationContextAttempts = useRef({ userId: "", listings: new Set<string>(), users: new Set<string>() });
  const contextAuthRef = useRef<string | undefined>(authUser?.id);
  contextAuthRef.current = authUser?.id;
  const contextEntitiesRef = useRef({ listings, users });
  contextEntitiesRef.current = { listings, users };
  useEffect(() => {
    const uid = authUser?.id;
    if (!isSupabaseConfigured || !uid || !accountLoaded) return;
    if (conversationContextAttempts.current.userId !== uid) conversationContextAttempts.current = { userId: uid, listings: new Set(), users: new Set() };
    const attempts = conversationContextAttempts.current;
    const own = conversations.filter((conversation) => conversation.participantIds.includes(uid));
    const knownListings = new Set(contextEntitiesRef.current.listings.map((item) => item.id));
    const knownUsers = new Set(contextEntitiesRef.current.users.map((item) => item.id));
    const listingIds = [...new Set(own.map((conversation) => conversation.listingId))].filter((id) => !knownListings.has(id) && !attempts.listings.has(id));
    const userIds = [...new Set(own.flatMap((conversation) => conversation.participantIds))].filter((id) => id !== uid && !knownUsers.has(id) && !attempts.users.has(id));
    if (!listingIds.length && !userIds.length) return;
    listingIds.forEach((id) => attempts.listings.add(id));userIds.forEach((id) => attempts.users.add(id));
    void Promise.all([
      listingIds.length ? fetchListingsByIds(listingIds).catch(() => null) : Promise.resolve(null),
      userIds.length ? fetchPublicProfiles(userIds).catch(() => []) : Promise.resolve([] as User[])
    ]).then(([snapshot, profiles]) => {
      if (contextAuthRef.current !== uid) return;
      if (snapshot?.listings.length) setListings((previous) => { const known = new Set(previous.map((item) => item.id));return [...previous, ...snapshot.listings.filter((item) => !known.has(item.id))]; });
      const extraUsers = [...(snapshot?.users ?? []), ...profiles];
      if (extraUsers.length) setUsers((previous) => { const known = new Set(previous.map((item) => item.id));return [...previous, ...extraUsers.filter((item) => { if (known.has(item.id)) return false;known.add(item.id);return true; })]; });
    });
  }, [conversations, authUser?.id, accountLoaded]);

  // Sunucudan gelen mesaj listesini yerel durumla birleştir: sunucuda OLMAYAN ama yerelde duran
  // "gönderilemedi" (tekrar dene bekleyen) ve son 2 dakikada yazılmış (yazımı süren) mesajlar
  // KORUNUR. Eskiden yenileme `setMessages(sunucu)` ile bunları siliyordu → başarısız mesajın
  // metni, sekme öne gelince sessizce kayboluyordu.
  const mergeServerMessages = (server: Message[], local: Message[]): Message[] => {
    const known = new Set(server.map((m) => m.id));
    const recent = msgStamp(new Date(Date.now() - 120000).toISOString());
    const keep = local.filter((m) => !known.has(m.id) && (m.status === "failed" || m.createdAt >= recent));
    return keep.length ? [...keep, ...server] : server;
  };
  // Aynı mantık konuşmalar için: bu oturumda açılmış (pendingConversations) ama sunucu listesinde
  // OLMAYAN yerel konuşma, sunucuya yazımı henüz doğrulanmadıysa (çevrimdışı/başarısız) ya da son
  // 2 dakikada açıldıysa (yazımdan ÖNCE başlamış bayat yenileme) KORUNUR. Eskiden yenileme onu
  // siliyordu → kullanıcının içinde olduğu sohbet "Konuşma bulunamadı"ya dönüyordu.
  const mergeServerConversations = (server: Conversation[], local: Conversation[]): Conversation[] => {
    if (!pendingConversations.current.size) return server;
    const known = new Set(server.map((c) => c.id));
    const pendingIds = new Set(Array.from(pendingConversations.current.values(), (c) => c.id));
    const recent = msgStamp(new Date(Date.now() - 120000).toISOString());
    const keep = local.filter((c) => !known.has(c.id) && pendingIds.has(c.id) && (!confirmedConversations.current.has(c.id) || c.createdAt >= recent));
    return keep.length ? [...keep, ...server] : server;
  };
  // Çıkışta kullanıcıya ÖZEL (private) durumları temizle → aynı tarayıcıda sıradaki
  // kullanıcı/oturum önceki kullanıcının konuşma/mesaj/favori/ortaklık/talep/satış/
  // bildirim verisini GÖRMESİN. Herkese açık listings/reviews korunur (public feed).
  const resetPrivateState = () => {
    pendingConversations.current.clear();
    conversationReady.current.clear();
    conversationAlias.current.clear();
    confirmedConversations.current.clear();
    // Sipariş/şikâyet/öneri de hesaba özeldir (yönetici hesabında TÜM kayıtlar) → sıradaki oturuma kalmasın.
    if (isSupabaseConfigured) { setOrders([]); setReports([]); setCategorySuggestions([]); setLocationSuggestions([]); }
    setConversations([]);
    setMessages([]);
    setFavorites([]);
    setFollowedSellerIds([]);
    setOffers([]);
    setBlockedUserIds([]);
    setPartnerships([]);
    setLeads([]);
    setSales([]);
    setNotifications([]);
  };
  // TEMBEL YAZIM güvencesi: konuşma satırı sunucuya ancak İLK MESAJLA yazılır; o ana kadar konuşma yalnız
  // yereldedir. Konuşma listesi toptan değiştirildiğinde (ör. hesap verisi ilk kez yüklenirken) böyle bir
  // konuşma state'ten düşerse kullanıcı içindeyken "Konuşma bulunamadı" görürdü → geri eklenir. Yalnız
  // sunucuya YAZILMAMIŞ ve bu hesaba ait olanlar; yazılmış olan zaten sunucu listesinde gelir.
  const conversationOwnerId = authUser?.id;
  useEffect(() => {
    if (!conversationOwnerId || !pendingConversations.current.size) return;
    const lost = Array.from(pendingConversations.current.values()).filter((c) => !confirmedConversations.current.has(c.id) && c.participantIds.includes(conversationOwnerId) && !conversations.some((item) => item.id === c.id));
    if (lost.length) setConversations((items) => [...lost.filter((c) => !items.some((item) => item.id === c.id)), ...items]);
  }, [conversations, conversationOwnerId]);
  // Öneriler: canlıda boş başlar (gerçek kullanıcı önerileriyle dolar), önizlemede örnek.
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>(
    isSupabaseConfigured ? [] : [
      { id: "cs-1", userId: "u-owner-2", userName: "Örnek Kullanıcı", suggestedPath: "El Sanatları > Seramik Atölye Ürünleri", note: "Örnek öneri.", status: "pending", createdAt: "2026-06-20" }
    ]
  );
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>(
    isSupabaseConfigured ? [] : [
      { id: "ls-1", userId: "u-owner-1", userName: "Örnek Kullanıcı", provinceId: 34, districtId: 34001, suggestedName: "Örnek Mahalle", type: "neighborhood", note: "Örnek öneri.", status: "pending", createdAt: "2026-06-21" }
    ]
  );

  useEffect(() => {
    let mounted = true;

    async function hydrateFromSupabase() {
      if (!isSupabaseConfigured) return;
      // UYGULAMA: son başarılı ilan listesi cihazda saklanır ve açılışta AĞI BEKLEMEDEN gösterilir
      // (yavaş/kopuk bağlantıda boş ekran ve bekleme olmaz); ağ yanıtı gelince güncel veriyle değişir.
      let showedCache = false;
      if (Platform.OS !== "web") {
        try {
          const cachedRaw = await AsyncStorage.getItem(MARKETPLACE_CACHE_KEY);
          const cached = cachedRaw ? JSON.parse(cachedRaw) as { at: number; listings: Listing[]; users: User[] } : null;
          if (mounted && cached && Array.isArray(cached.listings) && cached.listings.length > 0 && Date.now() - cached.at < MARKETPLACE_CACHE_MAX_AGE_MS) {
            setUsers(cached.users ?? []);
            setListings(cached.listings);
            setBackendMode("supabase");
            setMarketplaceInitialLoading(false);
            showedCache = true;
            prefetchListingImages(cached.listings.slice(0, 12));
          }
        } catch { /* önbellek okunamadı → normal yükleme */ }
      }
      try {
        const snapshot = await loadMarketplaceSnapshot();
        if (!mounted) return;
        if (!snapshot) {
          // Ağ/sunucu hatası veya boş yanıt → boş sayfa yerine "yeniden dene" (önbellek gösteriliyorsa o kalır).
          if (!showedCache) setMarketplaceLoadFailed(true);
          return;
        }
        // Canlı: yalnızca gerçek Supabase verisi (demo/mock birleştirme yok).
        setMarketplaceLoadFailed(false);
        setUsers(snapshot.users);
        setListings(snapshot.listings);
        mpOffsetRef.current = snapshot.listings.length;
        setMarketplaceHasMore(snapshot.listings.length >= 90);
        setBackendMode("supabase");
        // İlanlar hazır: açılış/iskelet ikincil verileri (ayar, blog, kategori) BEKLEMEDEN kapanır.
        setMarketplaceInitialLoading(false);
        if (Platform.OS !== "web") {
          // İlk ekrandaki kart görsellerini önceden indir: liste çizildiğinde görseller hazır olur (gri kutu görünmez).
          prefetchListingImages(snapshot.listings.slice(0, 12));
          const keep = snapshot.listings.slice(0, MARKETPLACE_CACHE_LISTINGS);
          const owners = new Set(keep.map((item) => item.ownerId));
          void AsyncStorage.setItem(MARKETPLACE_CACHE_KEY, JSON.stringify({ at: Date.now(), listings: keep, users: snapshot.users.filter((u) => owners.has(u.id)) })).catch(() => {});
        }
        // İkincil veriler (ayar/blog/kategori): biri hata verse bile ilanlar yüklendi;
        // her birini ayrı sararak birinin hatası diğerlerini engellemesin.
        const settings = await loadPlatformSettings().catch(() => null);
        if (mounted && settings) setPlatformSettings(settings);
        const [posts, pages, seo, cats, hidden] = await Promise.all([
          loadBlogPosts().catch(() => []),
          loadContentPages().catch(() => []),
          loadSeoSettings().catch(() => null),
          loadCategories().catch(() => []),
          fetchHiddenCategories().catch(() => [])
        ]);
        if (!mounted) return;
        setBlogPosts(posts);
        setContentPages(pages);
        if (seo) setSeoSettings(seo);
        setExtraCategories(cats);
        setHiddenCategoriesModule(hidden);
        setHiddenCategoriesState(hidden);
      } catch {
        if (mounted && !showedCache) setMarketplaceLoadFailed(true);
      } finally {
        // Ne olursa olsun skeleton'ı kapat — sonsuz yükleme yaşanmasın.
        if (mounted) setMarketplaceInitialLoading(false);
      }
    }

    hydrateFromSupabase();

    return () => {
      mounted = false;
    };
  }, []);

  // Admin/moderator girişinde TUM ilanlar (her statu) + kullanicilar yuklenir
  // (moderasyon, arama, yonetim icin). RLS admin disindakine sinirli veri verir.
  useEffect(() => {
    const role = authUser?.role;
    if (!supabase || (role !== "admin" && role !== "moderator" && role !== "super_admin")) return;
    let alive = true;
    void loadAdminSnapshot().then((snap) => {
      if (!alive || !snap) return;
      if (snap.listings.length) setListings((prev) => mergeById(prev, snap.listings));
      if (snap.users.length) setUsers((prev) => mergeById(prev, snap.users));
    });
    return () => { alive = false; };
  }, [authUser?.role, authUser?.id]);

  // Her girişli kullanıcı KENDİ ilanlarını (her statü) yükler → satıcı reload'da
  // onay-bekleyen/duraklatılmış/toplu-yüklenen ilanlarını satıcı panosunda görür
  // (katalog snapshot'ı yalnız active çeker). RLS owner=self ile sınırlar.
  // ÖNEMLİ: hydrate (loadMarketplaceSnapshot) listings'i REPLACE ediyor; bu yüzden
  // kendi ilanları hydrate BİTTİKTEN sonra merge edilir, yoksa üzerine yazılır.
  useEffect(() => {
    const uid = authUser?.id;
    if (!supabase || !uid || marketplaceInitialLoading) return;
    let alive = true;
    void loadOwnListings(uid).then((own) => {
      if (!alive || !own.length) return;
      setListings((prev) => mergeById(prev, own));
    });
    return () => { alive = false; };
  }, [authUser?.id, marketplaceInitialLoading]);

  useEffect(() => {
    if (!supabase) return;

    void getInitialAuthUrl().then((url) => {
      if (url) void handleSupabaseAuthUrl(url);
    });

    return subscribeToAuthUrls((url) => {
      void handleSupabaseAuthUrl(url);
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    let authRevision = 0;
    let receivedAuthEvent = false;
    let sessionUserId: string | null = null;
    let accountRevision = 0;
    async function loadProfile(userId: string, fallbackPhone?: string | null, fallbackName?: string | null, fallbackAvatar?: string | null) {
      const revision = ++authRevision;
      if (sessionUserId !== userId) { sessionUserId = userId; accountRevision++; }
      const accountLoadRevision = accountRevision;
      const fallback = userFromAuth(userId, fallbackPhone, fallbackName, fallbackAvatar);
      // Own profil'i SECURITY DEFINER RPC ile getir: phone kolon-grant'ı güvenlik için
      // kaldırıldığından `select("*")` "permission denied for column phone" verirdi (→ fallback,
      // role="user", admin linki kaybolurdu). get_my_profile auth.uid()'in KENDİ satırını
      // (phone dahil) döner. Bkz migration 20260813140000 / 20260813130000.
      const { data: myRows, error } = await supabase!.rpc("get_my_profile")
        .then(result => result, () => ({ data: null, error: { message: "Profile temporarily unavailable" } }));
      const data = (Array.isArray(myRows) ? myRows[0] : myRows) as Record<string, any> | null;

      const profile: User =
        data && !error
          ? {
              id: data.id,
              name: data.full_name,
              createdAt: data.created_at || undefined,
              phone: data.phone ?? fallback.phone,
              avatar: data.avatar_url || fallback.avatar,
              cover: typeof data.cover_url === "string" && data.cover_url ? data.cover_url : undefined,
              bio: data.bio ?? fallback.bio,
              verifiedPhone: data.verified_phone,
              verifiedIdentity: data.verified_identity,
              verifiedInstagram: Boolean(data.verified_instagram),
              rating: Number(data.rating ?? 0),
              listingCount: 0,
              successfulSales: Number(data.successful_sales ?? 0),
              followerCount: Number(data.follower_count ?? 0),
              responseRate: data.response_rate ?? 0,
              role: data.role ?? "user",
              status: (data.status as User["status"]) ?? "active",
              emailNotifications: data.email_notifications ?? true,
              // VERİ KAYBI DÜZELTMESİ: uzmanlık kategorileri YÜKLENMİYORDU (undefined) → profil-düzenle
              // formu boş başlıyor, kaydedince expertise_categories = [] ile ÜZERİNE YAZILIYOR
              // (vitrin/ortak-dizini uzmanlık filtresinden düşüyordu). Artık geri okunuyor.
              expertiseCategories: Array.isArray(data.expertise_categories) ? data.expertise_categories : [],
              city: typeof data.city === "string" && data.city.trim() ? data.city : undefined,
              username:data.username||undefined,districtId:data.district_id||undefined,website:data.website_url||undefined,instagram:data.instagram_handle||undefined,
              preferences: (data.preferences ?? {}) as Record<string, boolean>
            }
          : fallback;

      if (!mounted || revision !== authRevision) return;
      // Auth's signup trigger creates the profile. Restoring a session is read-only:
      // a temporary profile-read failure must never overwrite it with fallback values.
      // AUTH'U ÖNCE ATA: hesap-özeti (10 tablo) yavaş yüklenirken ya da bir tablosu hata
      // verirken kullanıcı "misafir" görünmesin / oturumu kaybolmuş sanılmasın. Eskiden
      // setAuthUser 4 zincirli await SONRASINDA çağrılıyordu; biri patlarsa auth hiç kurulmuyordu.
      setAuthUser(profile);
      setAuthReady(true);
      setBackendMode("supabase");
      setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
      // OLAY-KAPISI: hesap-özetini (10 tablo) yalnız kullanıcı DEĞİŞTİĞİNDE / ilk yüklemede çek.
      // Aynı kullanıcı için tekrar (TOKEN_REFRESHED ~saatlik, mount'ta çift INITIAL_SESSION)
      // yeniden yükleme, bir dilim timeout/hata ile [] dönünce açık sohbet/satış gibi İYİ veriyi
      // EZİYORDU. Realtime + optimistic yazımlar veriyi zaten güncel tutar. Senkron claim →
      // mount'taki eşzamanlı iki çağrı da dedup edilir.
      const alreadyLoaded = loadedAccountUserRef.current === profile.id;
      if (alreadyLoaded) { setAccountLoaded(true); return; }
      loadedAccountUserRef.current = profile.id;
      void syncSavedForUser(profile.id); // kayıtlı aramaları sunucuyla senkronla (cihazlar arası)
      // Hesap verisi + öneriler + takipler: her biri BAĞIMSIZ dirençli — biri patlasa diğerleri yüklenir.
      const [account, suggestions, myFollows, myBlocks, myOffers] = await Promise.all([
        loadAccountSnapshot(profile.id).catch(() => null),
        loadSuggestions().catch(() => ({ categorySuggestions: [], locationSuggestions: [] })),
        loadMyFollowsLive(profile.id).catch(() => [] as string[]),
        fetchBlockedUsers(profile.id).catch(() => [] as string[]),
        fetchOffersLive().catch(() => [] as Offer[])
      ]);
      if (!mounted || accountLoadRevision !== accountRevision) return;
      setAccountLoaded(true); // başarı ya da hata; artık boş=gerçekten-boş
      setFollowedSellerIds(myFollows);
      setBlockedUserIds(myBlocks);
      setOffers(myOffers);
      // Kategori/konum önerileri (RLS: kendi + admin hepsi) — kalıcı yüklensin.
      setCategorySuggestions(suggestions.categorySuggestions);
      setLocationSuggestions(suggestions.locationSuggestions);
      if (account) {
        setPartnerships(account.partnerships);
        setLeads(account.leads);
        setSales(account.sales);
        setOrders(account.orders);
        setReviews((items) => [...account.reviews, ...items.filter((item) => item.reviewerId !== profile.id && item.reviewedUserId !== profile.id)]);
        setFavorites(account.favorites);
        setConversations(account.conversations);
        setMessages(account.messages);
        setNotifications(account.notifications);
        setReports(account.reports);
      } else {
        // Toplam hata (ağ) → hiç veri yüklenmedi; ref'i sıfırla ki sonraki auth olayı yeniden denesin
        // (ezme riski yok: ortada ezilecek yüklenmiş veri yok).
        loadedAccountUserRef.current = null;
      }
    }

    // NATIVE ÇEVRİMDIŞI KORUMASI: erişim token'ının süresi dolmuşken (uygulama ~1 saatten uzun
    // kapalı kaldıysa) ağ yoksa auth-js yenilemeyi deneyip `session: null` döner — ama oturumu
    // cihazda SAKLI BIRAKIR (gerçek çıkışta/geçersiz token'da siler). Eskiden bu null "çıkış
    // yapıldı" sayılıyordu → çevrimdışı açılışta kullanıcı giriş duvarına düşüyordu. Saklı oturum
    // duruyorsa kullanıcıyı GİRİŞLİ tut; ağ gelince TOKEN_REFRESHED → loadProfile hesabı yükler
    // (o ana kadar accountLoaded=false → ekranlar "yükleniyor" gösterir, boş-veri göstermez).
    // Dönüş: true = ele alındı (oturum korundu ya da daha yeni bir auth olayı geldi), false = saklı oturum yok.
    async function keepStoredSession(revisionAtCall: number): Promise<boolean> {
      if (Platform.OS === "web") return false; // web davranışı değişmez
      const stored = await readStoredAuthUser();
      if (!mounted || revisionAtCall !== authRevision) return true;
      if (!stored) return false;
      setEmailVerified(Boolean(stored.email_confirmed_at));
      setAuthUser((previous) => previous ?? userFromAuth(stored.id, stored.phone, stored.user_metadata?.full_name, stored.user_metadata?.avatar_url || stored.user_metadata?.picture));
      setBackendMode("supabase");
      setAuthError(undefined);
      setAuthReady(true);
      return true;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || receivedAuthEvent) return;
      if (error) setAuthError(translateAuthError(error.message));
      const user = data.session?.user;
      if (user) {
        setEmailVerified(Boolean(user.email_confirmed_at));
        if (user.app_metadata?.provider === "google" || user.app_metadata?.provider === "apple") void recordExplicitOAuthConsent(user.id);
        // authReady'yi loadProfile BİTİNCE (authUser set olduktan sonra) işaretle. Eskiden aşağıda
        // KOŞULSUZ set ediliyordu → loadProfile async olduğundan authReady=true olurken authUser
        // henüz null → korumalı ekranlar (favoriler/mesajlar…) yenilemede AuthRequired FLAŞ ediyordu.
        void loadProfile(user.id, user.phone, user.user_metadata?.full_name, user.user_metadata?.avatar_url || user.user_metadata?.picture)
          .catch((e) => console.warn("loadProfile failed", e));
      } else if (mounted) {
        const markSignedOut = () => {
          setAuthUser(null);
          setEmailVerified(false);
          setAuthReady(true);
        };
        // Hata ile gelen null (yenileme ağ hatası) + cihazda saklı oturum → çıkış sayma (native).
        if (error && Platform.OS !== "web") {
          void keepStoredSession(authRevision).then((handled) => { if (!handled && mounted && !receivedAuthEvent) markSignedOut(); });
        } else markSignedOut();
      }
    }).catch((e) => {
      // Ağ reddinde (getSession fetch timeout/kopuk) authReady askıda kalmasın → UI kilitlenmesin.
      console.warn("getSession failed", e);
      if (mounted && !receivedAuthEvent) setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      receivedAuthEvent = true;
      const user = session?.user;
      if (user) {
        setEmailVerified(Boolean(user.email_confirmed_at));
        if (user.app_metadata?.provider === "google" || user.app_metadata?.provider === "apple") void recordExplicitOAuthConsent(user.id);
        // authReady loadProfile bitince (authUser set) → AuthRequired flaşı olmaz (getSession ile aynı).
        void loadProfile(user.id, user.phone, user.user_metadata?.full_name, user.user_metadata?.avatar_url || user.user_metadata?.picture)
          .catch((e) => console.warn("loadProfile failed", e));
      } else {
        const signOutLocally = () => {
          authRevision++;
          sessionUserId = null;
          accountRevision++;
          setAuthUser(null);
          setEmailVerified(false);
          loadedAccountUserRef.current = null; // çıkış → sonraki giriş hesap-özetini yeniden yüklesin
          setAccountLoaded(false);
          void syncSavedForUser(null); // kayıtlı aramaları temizle (paylaşılan tarayıcı gizliliği)
          // Oturum başka bir yolla kapandıysa (token süresi, başka sekmede çıkış) da
          // özel veriyi temizle → sonraki kullanıcıya sızmasın.
          resetPrivateState();
          setAuthReady(true);
        };
        // NATIVE açılış: INITIAL_SESSION null gelse de cihazda saklı oturum duruyorsa bu bir
        // ağ hatasıdır (bkz. keepStoredSession) → çıkış yapma. SIGNED_OUT vb. her zaman çıkıştır.
        if (Platform.OS !== "web" && event === "INITIAL_SESSION") {
          const revision = authRevision;
          void keepStoredSession(revision).then((handled) => { if (!handled && mounted && revision === authRevision) signOutLocally(); });
        } else signOutLocally();
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);


  useEffect(() => {
    if (!supabase || !authUser) return;
    const client = supabase;
    let subscribedOnce = false;
    let alive = true;

    const channel = client
      .channel(`account-realtime-${authUser.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          // DELETE (ilan silinince CASCADE): yalnız PK gelir → hayalet konuşmayı yerelden kaldır.
          if (payload.eventType === "DELETE") {
            const goneId = (payload.old as Record<string, any> | null)?.id as string | undefined;
            if (!goneId) return;
            setConversations((items) => (items.some((item) => item.id === goneId) ? items.filter((item) => item.id !== goneId) : items));
            setMessages((items) => (items.some((item) => item.conversationId === goneId) ? items.filter((item) => item.conversationId !== goneId) : items));
            return;
          }
          const row = payload.new as Record<string, any> | null;
          if (!row || !Array.isArray(row.participant_ids) || !row.participant_ids.includes(authUser.id)) return;
          const conversation: Conversation = {
            id: row.id,
            listingId: row.listing_id,
            sellerId: row.seller_id,
            buyerId: row.buyer_id ?? undefined,
            partnerId: row.partner_id ?? undefined,
            participantIds: row.participant_ids,
            status: row.status,
            lastMessageAt: row.last_message_at ? msgStamp(row.last_message_at) : msgStamp(row.created_at),
            createdAt: msgStamp(row.created_at)
          };
          confirmedConversations.current.add(conversation.id); // satır sunucuda VAR
          noteThreadActivity(row.id, row.last_message_at, row.created_at); // ham damgalar: mesajı olan konuşma "boş" sayılmasın
          setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
        }
      )
      .on(
        "postgres_changes",
        // INSERT + UPDATE: yeni mesajı ekler, `read=true` güncellemesini yansıtır
        // (böylece gönderenin "✓✓ okundu" göstergesi canlı güncellenir).
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const goneId = (payload.old as Record<string, any> | null)?.id as string | undefined;
            if (goneId) setMessages((items) => (items.some((item) => item.id === goneId) ? items.filter((item) => item.id !== goneId) : items));
            return;
          }
          const row = payload.new as Record<string, any> | null;
          if (!row || (row.sender_id !== authUser.id && row.receiver_id !== authUser.id)) return;
          const message: Message = {
            id: row.id,
            conversationId: row.conversation_id ?? `${row.listing_id}-${row.sender_id}-${row.receiver_id}`,
            listingId: row.listing_id,
            senderId: row.sender_id,
            receiverId: row.receiver_id,
            body: row.body,
            createdAt: msgStamp(row.created_at),
            read: row.read,
            attachmentUrl: row.attachment_url ?? undefined,
            attachmentType: row.attachment_type ?? undefined,
            attachmentName: row.attachment_name ?? undefined
          };
          setMessages((items) => {
            const idx = items.findIndex((item) => item.id === message.id);
            if (idx >= 0) {
              // UPDATE (ör. okundu bilgisi) — mevcut mesajı yerinde güncelle.
              const next = items.slice();
              next[idx] = message;
              return next;
            }
            return [message, ...items];
          });
          noteThreadHasMessages(message.conversationId);
          // Gerçek-zamanlı gelen mesaj, konuşmanın son-mesaj zamanını da güncellesin
          // (yoksa gelen kutusu sıralaması ve gösterilen saat bayat kalır). UPDATE (okundu bilgisi)
          // ESKİ bir mesaja ait olabilir → saati GERİ almasın; yalnız yeni mesaj ya da daha ileri damga yazar.
          const isNewMessage = payload.eventType === "INSERT";
          setConversations((items) => items.map((item) => (item.id === message.conversationId && (isNewMessage || item.lastMessageAt < message.createdAt) ? { ...item, lastMessageAt: message.createdAt } : item)));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${authUser.id}` },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          const notification: Notification = {
            id: row.id,
            userId: row.user_id,
            type: row.type,
            title: row.title,
            body: row.body,
            read: row.read,
            // Tam ISO damga (hesap-özetiyle AYNI biçim). Eskiden ilk 16 karakter alınıp saat dilimi
            // atılıyordu → UTC saat yerel sanılıyor (TR'de 3 saat ileri), Safari/Hermes'te Invalid Date.
            createdAt: row.created_at,
            metadata: parseNotifMeta(row.metadata)
          };
          setNotifications((items) => [notification, ...items.filter((item) => item.id !== notification.id)]);
          // Teklif bildirimi = karşı taraf teklif verdi/yanıtladı. `offers` tablosu realtime
          // yayınında değil → sohbetteki teklif kartı bayat kalıyordu; bildirim gelince tazele.
          // Sorgu başarısızsa (null) eldeki teklifler boş listeyle EZİLMEZ.
          if (payload.eventType === "INSERT" && row.type === "offer") void fetchOffersResultLive().then((rows) => { if (alive && rows) setOffers(rows); }).catch(() => {});
        }
      )
      // partnerships/leads/commissions: filtre YOK — RLS aboneye yalnizca gorme
      // yetkisi olan satirlari teslim eder (hem ortak hem satici tarafi).
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partnerships" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          const partnership: Partnership = {
            id: row.id,
            listingId: row.listing_id,
            partnerId: row.partner_id,
            refCode: row.ref_code,
            status: row.status,
            note: row.note,
            shareChannel: row.share_channel ?? undefined,
            audience: row.audience ?? undefined,
            platformHandle: row.platform_handle ?? undefined,
            reachEstimate: row.reach_estimate ?? undefined,
            rejectionReason: row.rejection_reason ?? undefined,
            approvedAt: row.approved_at?.slice(0, 10),
            createdAt: row.created_at.slice(0, 10)
          };
          setPartnerships((items) => [partnership, ...items.filter((item) => item.id !== partnership.id)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          const lead: Lead = {
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
          };
          setLeads((items) => [lead, ...items.filter((item) => item.id !== lead.id)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commissions" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          const sale: Sale = {
            id: row.id,
            listingId: row.listing_id,
            partnershipId: row.partnership_id,
            leadId: row.lead_id ?? "",
            amount: Number(row.sale_amount ?? row.amount ?? 0),
            quantity: Number(row.quantity ?? 1),
            commissionAmount: Number(row.amount ?? 0),
            status: row.status,
            buyerName: row.buyer_name ?? undefined,
            deliveryStatus: row.delivery_status ?? undefined,
            returnUntil: row.return_until?.slice(0, 10),
            approvedAt: row.approved_at?.slice(0, 10),
            paidAt: row.paid_at?.slice(0, 10),
            sellerMarkedPaidAt: row.seller_marked_paid_at?.slice(0, 10),
            partnerConfirmedPaidAt: row.partner_confirmed_paid_at?.slice(0, 10),
            payoutNote: row.payout_note ?? undefined
          };
          setSales((items) => [sale, ...items.filter((item) => item.id !== sale.id)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        (payload) => {
          const row = payload.new as Record<string, any> | null;
          if (!row) return;
          setPlatformSettings({
            allowSignups: row.allow_signups ?? true,
            reviewBeforePublish: row.review_before_publish ?? false,
            requireEmailVerification: row.require_email_verification ?? false,
            maintenanceMode: row.maintenance_mode ?? false,
            announcement: row.announcement ?? "",
            announcementActive: row.announcement_active ?? false
          });
        }
      )
      .subscribe((status) => {
        // YENİDEN bağlanma (ağ kopması / uyku sonrası): realtime kaçan INSERT'leri tekrar oynatmaz →
        // ilk abonelikten sonraki her SUBSCRIBED'da konuşma/mesaj/bildirimleri sunucudan tazele.
        if (status !== "SUBSCRIBED") return;
        if (!subscribedOnce) { subscribedOnce = true; return; }
        void loadAccountSnapshot(authUser.id).then((account) => {
          if (!alive || !account) return;
          // Sorgusu BAŞARISIZ olan dilim (account.failed) yazılmaz: yeniden bağlanma anı ağın en
          // kararsız olduğu andır; boş dönen dilim iyi veriyi (gelen kutusu, bildirimler) ezmesin.
          const failed = account.failed ?? {};
          if (!failed.conversations) setConversations((items) => mergeServerConversations(account.conversations, items));
          if (!failed.messages) setMessages((items) => mergeServerMessages(account.messages, items));
          if (!failed.notifications) setNotifications(account.notifications.map((n) => (notificationWrites.current.has(n.id) ? { ...n, read: true } : n)));
        }).catch(() => {});
      });

    return () => {
      alive = false;
      void client.removeChannel(channel);
    };
    // Yalnız kullanıcı DEĞİŞİNCE yeniden abone ol. Eskiden bağımlılık `authUser` nesnesiydi →
    // her profil/tercih kaydında kanal kapatılıp yeniden açılıyor, aradaki mesajlar kaçıyordu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);
  const value = useMemo<AppStore>(() => {
    // Canlı (Supabase) modda oturum yoksa misafir kullanıcı: kullanıcı giriş
    // yapmadan gezebilir; aksiyonlar (ilan ver, favori, mesaj) /auth'a yönlenir.
    const currentUser = authUser ?? (isSupabaseConfigured ? ANON_USER : (users.find((user) => user.id === currentUserId) ?? users[0] ?? ANON_USER));
    const liveUser = isLiveUser(currentUser);
    // Personel (admin/moderatör): ortaklık onayı/reddi ve komisyon anlaşmazlığı
    // gibi normalde satıcı/ortağa özel aksiyonları panelden yönetebilir (override).
    const staff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
    const isAuthenticated = isSupabaseConfigured ? authUser != null : true;
    // Askiya alinmis kullanici hicbir islem (ilan/mesaj/ortaklik/talep/favori)
    // yapamaz; RLS'e ek istemci koruması.
    const isSuspended = currentUser.status === "suspended" || currentUser.status === "deleted";

    // O(1) arama için id->kayit haritalari. find* bunlari kullanir; boylece
    // liste render'larinda (binlerce kart) O(n) lineer arama -> O(1) olur.
    const userById = new Map(users.map((u) => [u.id, u]));
    const listingById = new Map(listings.map((l) => [l.id, l]));
    const conversationById = new Map(conversations.map((c) => [c.id, c]));

    function createOrReuseConversation(listingId: string, receiverId: string, body?: string, fallbackListing?: Listing) {
      if (!isAuthenticated) { setAuthError("Mesaj göndermek için giriş yapmalısın."); return undefined; }
      if (isSuspended) return undefined;
      // Paylaşılan/derin-linkli ilan store feed'inde OLMAYABİLİR (yalnız remote fetch ile gelir) →
      // listings.find undefined → eskiden mesaj SESSİZCE başlamıyordu. Çağıran remote ilanı
      // fallback geçer → konuşma yine kurulur (yüksek-niyetli paylaşım trafiği ölmesin).
      const listing = listings.find((item) => item.id === listingId) ?? fallbackListing;
      if (!listing || listing.demo || receiverId === currentUser.id) return undefined;
      const pendingKey = `${listingId}:${receiverId}`;
      const inState = conversations.find(
        (item) => item.listingId === listingId && item.participantIds.includes(currentUser.id) && item.participantIds.includes(receiverId)
      );
      const existing = inState ?? pendingConversations.current.get(pendingKey);
      const now = msgStamp();
      const conversation: Conversation = existing ?? {
        id: newId("c", liveUser),
        listingId,
        sellerId: listing.ownerId,
        buyerId: listing.ownerId === currentUser.id ? receiverId : currentUser.id,
        partnerId: partnerships.find((item) => item.listingId === listingId && [currentUser.id, receiverId].includes(item.partnerId))?.partnerId,
        participantIds: [currentUser.id, receiverId],
        status: "open",
        lastMessageAt: now,
        createdAt: now
      };
      if (!existing) {
        // TEMBEL YAZIM: konuşma burada yalnız YERELDE açılır; sunucuya satır, İLK MESAJ gönderilirken
        // yazılır (deliverMessage → writeConversation). Eskiden "Mesaj"a dokunup hiçbir şey yazmayan her
        // ziyaretçi sunucuda boş bir konuşma satırı bırakıyordu (karşı tarafın hiç ihtiyaç duymadığı satır).
        // Yerel konuşma, ilk mesajına ya da oturumun sonuna kadar yenilemede korunur (mergeServerConversations).
        pendingConversations.current.set(pendingKey, conversation);
        setConversations((items) => [conversation, ...items]);
      } else {
        // Konuşma yalnız pendingConversations'ta kalmış olabilir (state'ten düşmüş): geri ekle; yoksa
        // çağıran var olmayan bir konuşmaya yönlenir ve "Konuşma bulunamadı" görür — her denemede.
        if (!inState) setConversations((items) => (items.some((item) => item.id === existing.id) ? items : [existing, ...items]));
        // Sunucuya yazımı daha önce BAŞARISIZ olduysa burada yeniden DENENMEZ: mesajsız yazım boş satır
        // bırakırdı. Yeniden yazımı, gönderilen / "tekrar dene" ile yinelenen mesaj tetikler (deliverMessage).
      }
      if (body?.trim()) {
        if (!rateLimitSync("message_send")) { setSyncError("Çok hızlı mesaj gönderiyorsun. Lütfen biraz yavaşla."); return conversation; }
        const message: Message = {
          id: newId("m", liveUser),
          conversationId: conversation.id,
          listingId,
          senderId: currentUser.id,
          receiverId,
          body: body.trim(),
          createdAt: now,
          read: false
        };
        setMessages((items) => [message, ...items]);
        setConversations((items) => items.map((item) => (item.id === conversation.id ? { ...item, lastMessageAt: message.createdAt } : item)));
        // conversationId + listingId ekli: bildirime dokununca DOĞRU sohbet açılır (eskiden
        // meta yoktu → "en son katılımcı görüşmesi"ne düşüyordu, çok görüşmede yanlış sohbet).
        // Başarısızsa mesajı SİLME (eskiden siliniyor + ham tarayıcı uyarısı çıkıyordu):
        // "failed" işaretle → baloncukta "Gönderilemedi · tekrar dene" görünür ve tek
        // dokunuşla yeniden gönderilir. sendConversationMessage ile aynı davranış.
        // İlk mesaj, konuşma satırı sunucuya YAZILDIKTAN sonra gider (eskiden iki istek paralel
        // gidiyor, mesaj önce varırsa RLS/FK reddi → "konuşma yok" sanılıp yerelden siliniyordu).
        deliverMessage(message);
      }
      return conversation;
    }
    /**
     * Mesaj gönderimi başarısız olduğunda NE OLDUĞUNU ayırt eder.
     *
     * Eskiden her başarısızlık "Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene."
     * diyordu ve bu ham bir tarayıcı uyarısı olarak çıkıyordu. Ama en sık sebep bağlantı
     * DEĞİL: ilan silinince conversations/messages CASCADE ile silinir, istemcinin
     * belleğindeki konuşma ise kalır → kullanıcı artık var olmayan bir sohbete yazar,
     * her deneme başarısız olur ve "bağlantını kontrol et" YANILTIR (bağlantı iyidir).
     *
     * Artık: geçici hata → baloncuk "failed" (tekrar dene). Kalıcı hata → hayalet
     * konuşma yerelden temizlenir ve kullanıcıya gerçek sebep söylenir.
     */
    function handleSendFailure(message: Message, code?: string) {
      // Sunucu hız-limiti (trg_throttle_messages, P0001): bağlantı değil → doğru sebebi söyle.
      if (code === "P0001") {
        setMessages((items) => items.map((m) => (m.id === message.id ? { ...m, status: "failed" } : m)));
        setSyncError("Kısa sürede çok fazla mesaj gönderdin. Birkaç dakika bekleyip mesajın altındaki “tekrar dene”ye dokun.");
        return;
      }
      void messageSendBlockedReason(message).then((reason) => {
        if (reason === "gone") {
          pendingConversations.current.forEach((c, key) => { if (c.id === message.conversationId) pendingConversations.current.delete(key); });
          setConversations((items) => items.filter((c) => c.id !== message.conversationId));
          setMessages((items) => items.filter((m) => m.conversationId !== message.conversationId));
          setSyncError("Bu görüşme artık mevcut değil — ilan kaldırılmış olabilir.");
          return;
        }
        if (reason === "denied") {
          setMessages((items) => items.map((m) => (m.id === message.id ? { ...m, status: "failed" } : m)));
          setSyncError("Bu görüşmeye artık mesaj gönderemezsin (kapatılmış veya engellenmiş).");
          return;
        }
        // Geçici (ağ/sunucu) → mesaj durur, tek dokunuşla tekrar denenir.
        setMessages((items) => items.map((m) => (m.id === message.id ? { ...m, status: "failed" } : m)));
      });
    }
    // Mesajı sunucuya yaz; alıcıya "Yeni mesaj" bildirimi YALNIZ mesaj gerçekten yazıldıysa gider.
    // Eskiden bildirim mesajdan ÖNCE ve bağımsız gönderiliyordu → engellenen/hız-limitine takılan
    // (yani alıcıya hiç ulaşmayan) mesajın önizlemesi yine de alıcının bildirimine düşüyordu:
    // engellenen kişi, engelleyene bildirim üzerinden yazmaya devam edebiliyordu.
    function deliverMessage(message: Message) {
      const announce = (conversationId: string) => {
        const preview = message.body || (message.attachmentType === "file" ? `📎 ${message.attachmentName ?? "Dosya"}` : "📷 Görsel");
        notify(message.receiverId, "message", "Yeni mesaj", `${currentUser.name}: ${preview.slice(0, 140)}`, { conversationId, listingId: message.listingId });
      };
      if (!liveUser) { announce(message.conversationId); return; }
      const pendingWrite = conversationReady.current.get(message.conversationId);
      // TEMBEL YAZIM: bu oturumda yerelde açılmış, sunucuya HİÇ yazılmamış konuşmanın satırı ilk mesajla
      // birlikte (mesajdan ÖNCE) yazılır. Yazım başarısızsa mesaj "failed" kalır; "tekrar dene" aşağıdaki
      // yeniden-yazım yolundan geçer.
      const unwritten = pendingWrite || confirmedConversations.current.has(message.conversationId)
        ? undefined
        : Array.from(pendingConversations.current.entries()).find(([, c]) => c.id === message.conversationId);
      // Konuşma satırının ilk yazımı başarısız olduysa (ağ) mesajdan önce YENİDEN dene; yoksa
      // "tekrar dene" hiç var olmayan konuşmaya yazmaya çalışıp sonsuza dek başarısız olurdu.
      const ready: Promise<string | null> = unwritten ? writeConversation(unwritten[1], unwritten[0]) : !pendingWrite ? Promise.resolve(message.conversationId) : pendingWrite.then((serverId) => {
        if (serverId) return serverId;
        const entry = Array.from(pendingConversations.current.entries()).find(([, c]) => c.id === message.conversationId);
        if (!entry) return null;
        // Başka bir mesaj yeniden yazımı zaten başlattıysa onu paylaş; yoksa başlat (takma-ad eşlemesi dahil).
        const current = conversationReady.current.get(message.conversationId);
        return current && current !== pendingWrite ? current : writeConversation(entry[1], entry[0]);
      });
      void ready.then((serverId) => {
        // Konuşma satırı sunucuda henüz yok (yazımı yine başarısız): mesajı yazmayı DENEME. Denenirse
        // sunucu "konuşma yok" (23503) der, bu da "ilan kaldırılmış" sanılıp konuşmayı ve kullanıcının
        // yazdığı metni yerelden SİLERDİ — oysa sorun geçicidir. "failed" kalır; "tekrar dene" önce
        // konuşmayı yeniden yazar.
        if (!serverId) {
          setMessages((items) => items.map((m) => (m.id === message.id ? { ...m, status: "failed" } : m)));
          return undefined;
        }
        // Konuşma sunucuda başka id ile zaten varsa mesaj ona yazılır.
        const target = { ...message, conversationId: serverId, status: undefined };
        return insertMessageResult(target).then((res) => { if (!res.ok) handleSendFailure(target, res.code); /* canlıda "Yeni mesaj" bildirimi sunucuda üretilir (messages AFTER INSERT) */ });
      }).catch(() => handleSendFailure(message));
    }
    // Konuşma satırını sunucuya yazar ve sonucu `conversationReady`'ye koyar (ilk yazım + yeniden deneme
    // AYNI yoldan geçer). Sunucuda aynı ilan+kişi için ZATEN konuşma varsa (başka cihaz / yarış) yenisi
    // açılmaz: yerel konuşma ve mesajları mevcut konuşmaya taşınır (tek thread).
    function writeConversation(conversation: Conversation, pendingKey: string): Promise<string | null> {
      const localId = conversation.id;
      const account = currentUser.id;
      const ready = insertConversation(conversation).then((serverId) => {
        if (!serverId) return null;
        // Yazım sürerken çıkış yapıldıysa (ref'ler temizlendi) sıradaki oturumun durumuna dokunma.
        if (favoriteAccount.current !== account) return serverId;
        confirmedConversations.current.add(localId);
        confirmedConversations.current.add(serverId);
        if (serverId !== localId) {
          conversationAlias.current.set(localId, serverId);
          pendingConversations.current.set(pendingKey, { ...conversation, id: serverId });
          setConversations((items) => (items.some((item) => item.id === serverId)
            ? items.filter((item) => item.id !== localId)
            : items.map((item) => (item.id === localId ? { ...item, id: serverId } : item))));
          setMessages((items) => items.map((item) => (item.conversationId === localId ? { ...item, conversationId: serverId } : item)));
        }
        return serverId;
      }).catch(() => null);
      conversationReady.current.set(localId, ready);
      return ready;
    }
    function notify(userId: string, type: Notification["type"], title: string, body: string, metadata?: NotificationMeta) {
      const notification: Notification = {
        id: newId("n", liveUser),
        userId,
        type,
        title,
        body,
        read: false,
        // TAM zaman damgası (eskiden today() = yalnız tarih → optimistik kopya "az önce" gösteremiyor,
        // DB now() ile de uyuşmuyordu). insertNotification created_at yazmaz → DB now() ile hizalı.
        createdAt: new Date().toISOString(),
        // Derin-link için metadata (ilan/ortaklık) — bildirim merkezi tıklanınca yönlendirir.
        ...(metadata ? { metadata } : {})
      };
      // CANLI MOD: başka bir kullanıcıya gidecek bildirimleri (mesaj, ortaklık, satış, ödeme, talep,
      // değerlendirme) SUNUCU tetikleyicileri üretir; istemcinin doğrudan yazdığı satır sunucuda
      // sessizce düşer. Bu yüzden canlıda yalnız KENDİNE yazılan bildirim gönderilir/eklenir.
      if (liveUser && userId !== currentUser.id) return;
      setNotifications((items) => [notification, ...items]);
      if (liveUser) void insertNotification(notification);
    }
    // Kritik yazımlar için güvenlik: canlı Supabase yazımı başarısız (false/exception)
    // olursa optimistik yerel değişikliği GERİ AL (rollback) ve görünür hata göster.
    // Yalnız canlı modda çağrılır; demo/mock modda mevcut local-only davranış korunur.
    function persistCritical(write: Promise<boolean>, rollback: () => void, message: string) {
      write
        .then((ok) => { if (!ok) { rollback(); setSyncError(message); } })
        .catch(() => { rollback(); setSyncError(message); });
    }
    // Rollback'i karmaşık/gereksiz olan (ör. admin moderasyonu — sahip reload'da
    // gerçeği görür) yazımlar için: hata olursa yalnız görünür uyarı göster.
    function persistOrWarn(write: Promise<boolean>, message: string) {
      write
        .then((ok) => { if (!ok) setSyncError(message); })
        .catch(() => setSyncError(message));
    }
    // Sonucu ÇAĞIRANA dönen yazımlar için: istisna da "başarısız" sayılır (asla reddetmez).
    function settleWrite(write: Promise<boolean>): Promise<boolean> {
      return write.then((ok) => ok === true, () => false);
    }

    return {
      backendMode,
      authReady,
      authError,
      syncError,
      clearSyncError() { setSyncError(null); },
      async authAttempt(action) {
        lastAuthErrorRef.current = undefined;
        const ok = await action();
        return { ok, error: ok ? undefined : lastAuthErrorRef.current };
      },
      currentUser,
      isAuthenticated,
      pendingVerifyEmail,
      clearPendingVerify() { setPendingVerifyEmail(null); },
      users,
      listings,
      partnerships,
      leads,
      sales,
      orders,
      reviews,
      favorites,
      conversations,
      messages,
      notifications,
      reports,
      async signInWithEmail(email, password) {
        const sv = validateSignIn({ email, password });
        if (!sv.ok) {
          setAuthError(firstError(sv) ?? "Bilgileri kontrol edin.");
          return false;
        }
        const rl = await rateLimit("signin");
        if (!rl.allowed) {
          setAuthError(rl.reason);
          return false;
        }
        if (!supabase) {
          const cleanEmail = email.trim().toLowerCase();
          const acct = mockAccounts[cleanEmail];
          if (!acct || acct.password !== password) {
            setAuthError("E-posta veya şifre hatalı. (Önizleme modunda önce kayıt olun.)");
            return false;
          }
          setAuthError(undefined);
          setAuthUser(acct.user);
          setUsers((items) => [acct.user, ...items.filter((item) => item.id !== acct.user.id)]);
          return true;
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        });
        setAuthError(translateAuthError(error?.message));
        if (data.user) {
          const profile = userFromAuth(data.user.id, data.user.phone, data.user.user_metadata?.full_name ?? data.user.email);
          // Oturumu ANINDA aç (yönlendirme beklemesin). Profil upsert'i ARKA PLANDA —
          // eskiden `await ensureProfile` ağ takılırsa giriş butonu sonsuza donuyordu.
          // Auth-state dinleyicisi (loadProfile) zaten profili + hesap-özetini yükler.
          setAuthUser(profile);
          setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
          void ensureProfile(profile).catch(() => {});
          void logActivity("sign_in", { userId: profile.id });
        }
        return !error;
      },
      async signUpWithEmail(input) {
        if (input.legalAccepted !== true) { setAuthError("Önce yasal metinleri kabul etmelisin."); return false; }
        if (!platformSettings.allowSignups) {
          setAuthError("Yeni kayıtlar şu anda geçici olarak kapalıdır. Lütfen daha sonra tekrar deneyin.");
          return false;
        }
        const sv = validateSignUp({ name: input.name, email: input.email, password: input.password });
        if (!sv.ok) {
          setAuthError(firstError(sv) ?? "Bilgileri kontrol edin.");
          return false;
        }
        const rl = await rateLimit("signup");
        if (!rl.allowed) {
          setAuthError(rl.reason);
          return false;
        }
        if (!supabase) {
          const cleanEmail = input.email.trim().toLowerCase();
          const displayName = input.name.trim() || cleanEmail;
          if (mockAccounts[cleanEmail]) {
            setAuthError("Bu e-posta ile zaten kayıt var. Giriş yapabilirsin.");
            return false;
          }
          const mockUser: User = {
            id: `mock-${cleanEmail}`,
            name: displayName,
            phone: "",
            avatar: displayName.slice(0, 2).toLocaleUpperCase("tr-TR"),
            bio: "",
            verifiedPhone: false,
            verifiedIdentity: false,
            rating: 5,
            listingCount: 0,
            successfulSales: 0,
            followerCount: 0,
            responseRate: 100
          };
          setMockAccounts((m) => ({ ...m, [cleanEmail]: { password: input.password, user: mockUser } }));
          setAuthError(undefined);
          return true;
        }
        const cleanEmail = input.email.trim().toLowerCase();
        const displayName = input.name.trim() || cleanEmail;
        const legalAcceptedAt = new Date().toISOString();
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: input.password,
          options: {
            data: {
              full_name: displayName,
              legal_terms_accepted: true,
              legal_accepted_at: legalAcceptedAt,
              legal_version: LEGAL_CONSENT_VERSION
            },
            // Web'de doğrulama linki tarayıcıya (siteye) dönmeli; native şemaya
            // (ortaksat://) sabitlenirse mobil-web kullanıcısı e-postadaki linki
            // tarayıcıda açamaz ve hesabını onaylayamaz.
            emailRedirectTo: authRedirectUrl()
          }
        });
        setAuthError(translateAuthError(error?.message));
        if (data.session?.user) {
          // Otomatik onay açık: yeni kayıt anında oturum döndürür → hemen giriş yap.
          const profile = userFromAuth(data.session.user.id, data.session.user.phone, displayName);
          // Oturumu ANINDA aç; profil upsert + yasal onay kaydı ARKA PLANDA (bloklamaz →
          // "Kayıt açılıyor…" donması yok). ensureProfile bitince yasal onaylar yazılır (FK sırası).
          setAuthUser(profile);
          setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
          void ensureProfile(profile)
            .then(() => Promise.all(LEGAL_DOCUMENT_TYPES.map((documentType) => recordLegalConsentLive(profile.id, documentType))))
            .catch(() => {});
          void logActivity("sign_up", { userId: profile.id });
        } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          // Supabase e-posta sızıntı koruması: bu e-posta ZATEN KAYITLI (gizli yanıt —
          // oturum yok, hata yok). Kod ekranı gösterme (otomatik-onay açıkken kod GELMEZ) →
          // kullanıcıyı net biçimde girişe/şifre-sıfırlamaya yönlendir.
          setAuthError("Bu e-posta ile zaten bir hesap var. Lütfen giriş yap ya da 'Şifremi unuttum' ile sıfırla.");
          return false;
        } else if (!error) {
          // Oturum dönmedi ama kullanıcı yeni (nadiren: e-posta onayı manuel açıksa) →
          // e-postaya KOD gitti, kod ekranına geç.
          setPendingVerifyEmail(cleanEmail);
        }
        return !error;
      },
      async resetPasswordWithEmail(email) {
        if (!isValidEmail(email)) {
          setAuthError("Geçerli bir e-posta girin.");
          return false;
        }
        const rl = await rateLimit("password_reset");
        if (!rl.allowed) {
          setAuthError(rl.reason);
          return false;
        }
        if (!supabase) {
          // Preview mode: simulate sending a reset link (no real email backend).
          setAuthError(undefined);
          return true;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          // Web'de şifre sıfırlama linki siteye dönmeli (native şema tarayıcıda açılmaz).
          redirectTo: authRedirectUrl()
        });
        setAuthError(translateAuthError(error?.message));
        return !error;
      },
      async updatePasswordWithEmail(password) {
        if (!supabase) {
          // Preview mode: update the password of the currently signed-in mock account.
          const entry = Object.entries(mockAccounts).find(([, v]) => v.user.id === authUser?.id);
          if (entry) setMockAccounts((m) => ({ ...m, [entry[0]]: { ...m[entry[0]], password } }));
          setAuthError(undefined);
          return true;
        }
        const { error } = await supabase.auth.updateUser({ password });
        setAuthError(translateAuthError(error?.message));
        return !error;
      },
      // Şifremi unuttum — KOD ile (link/uygulama-değiştirme yok): e-postaya gelen
      // kurtarma kodu + yeni şifre aynı ekranda girilir. (Supabase "Reset password"
      // şablonunda {{ .Token }} bulunmalı ki link değil KOD gitsin.)
      async resetPasswordWithCode(email, code, newPassword) {
        if (!supabase) { setAuthError("Kod ile sıfırlama yalnızca canlı modda çalışır."); return false; }
        if (newPassword.length < 6) { setAuthError("Yeni şifre en az 6 karakter olmalı."); return false; }
        const cleanEmail = email.trim().toLowerCase();
        const token = code.replace(/\D/g, "");
        if (token.length < 6) { setAuthError("6 haneli kodu eksiksiz gir."); return false; }
        const { error: vErr } = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: "recovery" });
        // Hata metinleri Türkçeleştirilir (yanlış kodda ekranda "Token has expired or is invalid" çıkıyordu).
        if (vErr) { setAuthError(translateAuthError(vErr.message)); return false; }
        const { error: uErr } = await supabase.auth.updateUser({ password: newPassword });
        setAuthError(translateAuthError(uErr?.message));
        return !uErr;
      },
      async signInWithGoogle(legalAccepted) {
        if (legalAccepted !== true) { setAuthError("Önce yasal metinleri kabul etmelisin."); return false; }

        if (!supabase) {
          setAuthError("Google ile giriş yalnızca canlı (Supabase) modda çalışır.");
          return false;
        }
        try { await prepareOAuthConsent(); }
        catch { setAuthError("Onay kaydedilemedi. Lütfen tekrar dene."); return false; }
        const isWebEnv = Platform.OS === "web";
        // Web'de tarayıcı Google'a yönlenir, dönüşte onAuthStateChange oturumu yakalar.
        // Native'de otomatik yönlenme YOK → URL'yi expo-web-browser ile aç, dönüşü işle.
        const redirectTo = oauthRedirectUrl();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          // Her seferinde hesap seçtir: yanlış Google hesabıyla sessizce girilmesin.
          options: { redirectTo, skipBrowserRedirect: !isWebEnv, queryParams: { prompt: "select_account" } }
        });
        if (error) {
          await clearOAuthConsent();
          // Sağlayıcı Supabase'de etkin değilse anlaşılır mesaj göster.
          setAuthError(
            /provider.*not enabled|not enabled|unsupported/i.test(error.message)
              ? "Google ile giriş henüz etkin değil. Yönetici panelinden Google sağlayıcısını açın."
              : error.message
          );
          return false;
        }
        // Native: tarayıcı oturumunu aç (auth session) ve dönen URL'deki token'ları işle.
        if (!isWebEnv) {
          if (!data?.url) { setAuthError("Google bağlantısı açılamadı, lütfen tekrar dene."); return false; }
          try {
            const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
            if (res.type !== "success" || !res.url) { await clearOAuthConsent(); return false; } // kullanıcı iptal etti — sessiz
            const ok = await handleSupabaseAuthUrl(res.url);
            if (!ok) { await clearOAuthConsent(); setAuthError("Google oturumu tamamlanamadı, lütfen tekrar dene."); return false; }
          } catch {
            await clearOAuthConsent();
            setAuthError("Google ile bağlantı kurulamadı, lütfen tekrar dene.");
            return false;
          }
        }
        setAuthError(undefined);
        return true;
      },
      // APPLE İLE GİRİŞ (yalnız iOS uygulaması). Apple'ın yerel penceresi kimlik belirteci (identity token)
      // verir; Supabase bu belirteci doğrulayıp oturum açar — tarayıcı yönlendirmesi ve gizli anahtar gerekmez.
      // Tek kullanımlık değer (nonce): ham değer Supabase'e, SHA-256 özeti Apple'a gider; belirteç başka bir
      // oturumda yeniden kullanılamaz. Modüller tembel yüklenir (Android / eski derlemede yoktur).
      async signInWithApple(legalAccepted) {
        if (legalAccepted !== true) { setAuthError("Önce yasal metinleri kabul etmelisin."); return false; }
        if (!supabase) { setAuthError("Apple ile giriş yalnızca canlı (Supabase) modda çalışır."); return false; }
        if (Platform.OS !== "ios") { setAuthError("Apple ile giriş yalnızca iPhone ve iPad uygulamasında kullanılabilir."); return false; }
        try { await prepareOAuthConsent(); }
        catch { setAuthError("Onay kaydedilemedi. Lütfen tekrar dene."); return false; }
        try {
          const Apple = require("expo-apple-authentication") as typeof import("expo-apple-authentication");
          const Crypto = require("expo-crypto") as typeof import("expo-crypto");
          if (!(await Apple.isAvailableAsync())) {
            await clearOAuthConsent();
            setAuthError("Bu cihazda Apple ile giriş kullanılamıyor. E-posta ile giriş yapabilirsin.");
            return false;
          }
          const rawNonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
          const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
          const credential = await Apple.signInAsync({
            requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
            nonce: hashedNonce
          });
          if (!credential.identityToken) {
            await clearOAuthConsent();
            setAuthError("Apple kimlik bilgisi alınamadı. Lütfen tekrar dene.");
            return false;
          }
          const { data, error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
          if (error || !data.user) {
            await clearOAuthConsent();
            const message = error?.message ?? "";
            setAuthError(
              /provider.*not enabled|not enabled|unsupported/i.test(message)
                ? "Apple ile giriş henüz etkin değil."
                : /audience|client[_ ]id|unacceptable/i.test(message)
                  ? "Apple ile giriş bu uygulama kurulumu için tanımlı değil. E-posta ile giriş yapabilirsin."
                  : translateAuthError(message) ?? "Apple oturumu tamamlanamadı, lütfen tekrar dene."
            );
            return false;
          }
          // Apple adı YALNIZ ilk girişte ve yalnız cihaza verir (belirteçte yoktur) → hesaba ve profile yaz.
          const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
          if (fullName && !data.user.user_metadata?.full_name) {
            const userId = data.user.id;
            await supabase.auth.updateUser({ data: { full_name: fullName } }).then(() => undefined, () => undefined);
            await supabase.from("profiles").update({ full_name: fullName }).eq("id", userId).then(() => undefined, () => undefined);
            setAuthUser((current) => (current && current.id === userId ? { ...current, name: fullName } : current));
          } else if (!fullName && !data.user.user_metadata?.full_name) {
            // Apple bu girişte ad vermedi (daha önce yetki verilmiş cihazlarda hiç vermez) → profil adı nötr
            // yer tutucudur ("OrtakSat Kullanıcısı"); kullanıcıya adını ekleyebileceği söylenir.
            showToast("Apple adını paylaşmadı. Adını Profil › Profili Düzenle bölümünden ekleyebilirsin.");
          }
          setAuthError(undefined);
          return true;
        } catch (e) {
          await clearOAuthConsent();
          // Kullanıcı Apple penceresini kapattı → sessiz.
          if ((e as { code?: string } | null)?.code === "ERR_REQUEST_CANCELED") return false;
          setAuthError("Apple ile bağlantı kurulamadı, lütfen tekrar dene.");
          return false;
        }
      },
      // E-posta doğrulama KODU ile: kayıt sonrası kullanıcı e-postasına gelen 6 haneli
      // kodu aynı ekranda girer; link/uygulama-değiştirme yok. Supabase native (harici
      // SMS/e-posta şirketi gerekmez). Not: Supabase panelinde "Confirm signup" e-posta
      // şablonunda {{ .Token }} bulunmalı ki kullanıcıya link değil KOD gitsin.
      async verifyEmailCode(email, code) {
        if (!supabase) { setAuthError("Kod doğrulama yalnızca canlı modda çalışır."); return false; }
        const cleanEmail = email.trim().toLowerCase();
        const token = code.replace(/\D/g, "");
        if (token.length < 6) { setAuthError("6 haneli kodu eksiksiz gir."); return false; }
        const { data, error } = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: "signup" });
        setAuthError(translateAuthError(error?.message));
        if (error || !data.session?.user) return false;
        const displayName = (data.session.user.user_metadata?.full_name as string) || cleanEmail;
        const profile = userFromAuth(data.session.user.id, data.session.user.phone, displayName);
        await ensureProfile(profile);
        setAuthUser(profile);
        setUsers((items) => [profile, ...items.filter((item) => item.id !== profile.id)]);
        setPendingVerifyEmail(null);
        void logActivity("sign_up", { userId: profile.id });
        return true;
      },
      async resendEmailCode(email) {
        if (!supabase) return false;
        const rl = await rateLimit("signup");
        if (!rl.allowed) { setAuthError(rl.reason); return false; }
        const cleanEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: cleanEmail,
          options: { emailRedirectTo: authRedirectUrl() }
        });
        setAuthError(translateAuthError(error?.message));
        return !error;
      },
      async signOut() {
        // Bu cihazın push token'ını oturum AÇIKKEN sil (RLS: yalnız sahibi silebilir). Yoksa çıkış
        // yapan kullanıcının bildirimleri bu cihaza gelmeye devam eder (sıradaki kullanıcı görür).
        await unregisterPush().catch(() => {});
        if (supabase) await supabase.auth.signOut();
        setAuthUser(null);
        resetPrivateState();
      },
      // Tüm cihazlardan çıkış: sunucudaki tüm refresh token'ları geçersiz kılar
      // (scope: "global"). Bu cihazdaki oturum da kapanır.
      async signOutAllDevices() {
        if (!supabase) { setAuthUser(null); resetPrivateState(); return true; }
        void logActivity("sign_out", { userId: authUser?.id, metadata: { scope: "global" } });
        await unregisterPush().catch(() => {});
        const { error } = await supabase.auth.signOut({ scope: "global" });
        if (error) { setAuthError(translateAuthError(error.message)); return false; }
        setAuthUser(null);
        resetPrivateState();
        return true;
      },
      // Tercih kaydı: sunucuya YALNIZ DEĞİŞEN anahtarlar gider (rpc merge_my_preferences sunucuda birleştirir;
      // null = anahtarı sil) ve yerel durum sunucunun döndürdüğü TAM nesneden kurulur. Eskiden tüm JSON
      // bayat olabilen yerel durumdan yazılıyordu → eşzamanlı iki kayıt birbirini eziyordu. Çağıran tam bir
      // nesne verse de mevcut durumla karşılaştırılıp yalnız fark gönderilir. İyimser; hata → geri alınır.
      async savePreferences(preferences) {
        type Prefs = Record<string, boolean | string | number>;
        const uid = currentUser.id;
        // Oturumu olmayan (anon / ön izleme) hesapta tercih kaydı yok — eskiden de false dönerdi.
        if (favoriteAccount.current !== uid) return false;
        const before: Prefs = currentUser.preferences ?? {};
        const patch: Record<string, boolean | string | number | null> = {};
        for (const [key, value] of Object.entries(preferences)) {
          if (value === undefined) continue;
          if (value === null) { if (key in before) patch[key] = null; }
          else if (before[key] !== value) patch[key] = value;
        }
        if (!Object.keys(patch).length) return true;
        const overlay = (base: Prefs, patches: Array<typeof patch>): Prefs => {
          const next = { ...base };
          for (const item of patches) for (const [key, value] of Object.entries(item)) { if (value === null) delete next[key]; else next[key] = value; }
          return next;
        };
        // İşlevsel güncelleme: art arda iki kayıt aynı (bayat) kullanıcı nesnesinden türeyip birbirini ezmesin.
        const applyPreferences = (update: (prefs: Prefs) => Prefs) => {
          setUsers((items) => {
            const base = items.find((item) => item.id === uid) ?? currentUser;
            return [{ ...base, preferences: update(base.preferences ?? {}) }, ...items.filter((item) => item.id !== uid)];
          });
          setAuthUser((user) => (user && user.id === uid ? { ...user, preferences: update(user.preferences ?? {}) } : user));
        };
        applyPreferences((prefs) => overlay(prefs, [patch]));
        if (!liveUser) return true;
        preferenceWrites.current.push(patch);
        // Hesap arada değiştiyse yama gönderilmez (RPC kimliği oturumdan alır → başka hesaba yazılırdı).
        const run = preferenceQueue.current.then(() => (favoriteAccount.current === uid ? mergePreferencesLive(uid, patch) : null));
        preferenceQueue.current = run.catch(() => null);
        const merged = await run.catch(() => null);
        preferenceWrites.current = preferenceWrites.current.filter((item) => item !== patch);
        if (favoriteAccount.current !== uid) return false;
        if (!merged) {
          // Geri al: yalnız BU kaydın anahtarları eski değerine döner (bekleyen başka bir kaydın dokunduğu anahtar hariç).
          const pendingKeys = new Set(preferenceWrites.current.flatMap((item) => Object.keys(item)));
          applyPreferences((prefs) => {
            const next = { ...prefs };
            for (const key of Object.keys(patch)) {
              if (pendingKeys.has(key)) continue;
              if (key in before) next[key] = before[key]; else delete next[key];
            }
            return next;
          });
          setAuthError("Tercihler kaydedilemedi.");
          return false;
        }
        // Sunucunun birleşmiş nesnesi esastır; yanıtı henüz gelmemiş kayıtların iyimser değerleri üstüne bindirilir.
        const settled = overlay(merged, preferenceWrites.current);
        applyPreferences(() => settled);
        return true;
      },
      async setEmailNotifications(enabled) {
        const updatedUser: User = { ...currentUser, emailNotifications: enabled };
        const ok = liveUser ? await saveEmailNotificationsLive(currentUser.id, enabled) : true;
        if (!ok) { setAuthError("E-posta bildirim tercihi kaydedilemedi."); return false; }
        setUsers((items) => [updatedUser, ...items.filter((item) => item.id !== updatedUser.id)]);
        if (authUser?.id === updatedUser.id) setAuthUser(updatedUser);
        return true;
      },
      async updateProfile(input) {
        const nextPhone = input.phone.trim();
        const phoneChanged = nextPhone !== currentUser.phone;
        const updatedUser: User = {
          ...currentUser,
          name: input.name.trim() || currentUser.name,
          phone: nextPhone,
          avatar: input.avatar.trim() || currentUser.avatar,
          bio: input.bio.trim(),
          verifiedPhone: phoneChanged ? false : currentUser.verifiedPhone,
          expertiseCategories: input.expertiseCategories ?? currentUser.expertiseCategories ?? [],
          username:input.username!==undefined?(input.username.trim()||undefined):currentUser.username,
          districtId:input.districtId!==undefined?(input.districtId||undefined):input.city!==undefined&&input.city!==currentUser.city?undefined:currentUser.districtId,
          website:input.website!==undefined?(input.website.trim()||undefined):currentUser.website,
          instagram:input.instagram!==undefined?(input.instagram.trim()||undefined):currentUser.instagram,
          city: input.city !== undefined ? (input.city.trim() || undefined) : currentUser.city,
          cover: input.cover !== undefined ? (input.cover || undefined) : currentUser.cover
        };
        const ok = liveUser ? await updateProfileLive(updatedUser) : true;
        if (!ok) {
          setAuthError("Profil güncellenemedi. Lütfen tekrar dene.");
          return false;
        }
        if(favoriteAccount.current!==currentUser.id)return false;
        setAuthError(undefined);
        setUsers((items) => [updatedUser, ...items.filter((item) => item.id !== updatedUser.id)]);
        if (authUser?.id === updatedUser.id) setAuthUser(updatedUser);
        return true;
      },
      async reportListing(listingId, reason, details,options) {
        if (!liveUser) {
          setAuthError("Bildirim göndermek için e-posta ile giriş yapmalısın.");
          return false;
        }
        const reportId = await insertReport({
          reporterId: currentUser.id,
          listingId,
          reason,
          details,
          ...options
        });
        if (reportId) {
          setReports((items) => [
            {
              id: reportId,
              reporterId: currentUser.id,
              listingId,
              reason,
              details: details ?? "",
              status: "open",
              createdAt: today()
            },
            ...items
          ]);
        }
        return Boolean(reportId);
      },
      async reportUser(reportedUserId, reason, details,options) {
        if (!liveUser) {
          setAuthError("Bildirim göndermek için e-posta ile giriş yapmalısın.");
          return false;
        }
        if (reportedUserId === currentUser.id) return false;
        const reportId = await insertReport({ reporterId: currentUser.id, reportedUserId, reason, details, ...options });
        if (reportId) {
          setReports((items) => [
            { id: reportId, reporterId: currentUser.id, reportedUserId, reason, details: details ?? "", status: "open", createdAt: today() },
            ...items
          ]);
        }
        return Boolean(reportId);
      },
      async requestVerification(note) {
        if (!liveUser) { setAuthError("Doğrulama talebi için e-posta ile giriş yapmalısın."); return false; }
        // Zaten açık bir talebi varsa tekrar oluşturma (spam engeli).
        const existing = reports.find((r) => r.reporterId === currentUser.id && r.reportedUserId === currentUser.id && r.reason.startsWith("DOĞRULAMA TALEBİ") && r.status === "open");
        if (existing) return true;
        const reason = "DOĞRULAMA TALEBİ";
        const details = note?.trim() || "Kullanıcı hesap doğrulaması (kimlik/telefon) talep ediyor.";
        // reports RLS: reporter_id=auth.uid() → self-talep DB'de geçerli.
        const reportId = await insertReport({ reporterId: currentUser.id, reportedUserId: currentUser.id, reason, details });
        if (reportId) {
          setReports((items) => [
            { id: reportId, reporterId: currentUser.id, reportedUserId: currentUser.id, reason, details, status: "open", createdAt: today() },
            ...items
          ]);
        }
        return Boolean(reportId);
      },
      async updateReportStatus(reportId, status) {
        const report = reports.find((item) => item.id === reportId);
        if (!report) return false;
        if (!liveUser || !["admin", "moderator", "super_admin"].includes(currentUser.role ?? "")) return false;
        const ok = await updateReportStatusLive(report, status, currentUser.id);
        if (ok) {
          setReports((items) =>
            items.map((item) =>
              item.id === reportId
                ? {
                    ...item,
                    status,
                    resolvedBy: status === "resolved" || status === "rejected" ? currentUser.id : item.resolvedBy,
                    resolvedAt: status === "resolved" || status === "rejected" ? today() : item.resolvedAt
                  }
                : item
            )
          );
        }
        return ok;
      },
      async recordLegalConsent(documentType) {
        if (!liveUser) {
          setAuthError("Rıza kaydı için e-posta ile giriş yapmalısın.");
          return false;
        }
        return recordLegalConsentLive(currentUser.id, documentType);
      },
      async createSupportTicket(subject, message, options) {
        if (!liveUser) {
          setAuthError("Destek talebi için e-posta ile giriş yapmalısın.");
          return false;
        }
        if (!subject.trim() || !message.trim()) return false;
        return createSupportTicketLive({ userId: currentUser.id, subject: subject.trim(), message: message.trim(), ...options });
      },
      async requestAccountDeletion(reason) {
        if (!liveUser) {
          setAuthError("Hesap silme talebi için e-posta ile giriş yapmalısın.");
          return false;
        }
        return requestAccountDeletionLive({ userId: currentUser.id, reason: reason.trim() || "Kullanıcı hesap silme talebi oluşturdu." });
      },
      // Sunucu profili yeniden aktif eder ve talebin duraklattığı ilanları geri açar; burada yalnız
      // yerel hesap durumu eşitlenir (çağıran ardından refreshMarketplace/refreshUserData çalıştırır).
      async cancelAccountDeletion() {
        if (!liveUser) return false;
        const account = currentUser.id;
        if (!await cancelAccountDeletionLive()) return false;
        const restored: User = { ...currentUser, status: "active" };
        setUsers((items) => [restored, ...items.filter((item) => item.id !== account)]);
        if (authUser?.id === account) setAuthUser(restored);
        return true;
      },
      async createListing(input, statusOverride) {
        const titleCheck = validateListingTitle(input.title);
        if (titleCheck.error) throw new Error(titleCheck.error);
        if (!isAuthenticated) throw new Error("İlan vermek için giriş yapmalısın.");
        const id = newId("l", liveUser);
        // Admin "yayindan once incele" acikken (moderasyon zaten pending/rejected
        // demediyse) tum yeni ilanlar pending_review'a duser.
        const resolvedStatus: Listing["status"] =
          statusOverride === "draft" || statusOverride === "pending_review" || statusOverride === "rejected"
            ? statusOverride
            : platformSettings.reviewBeforePublish
              ? "pending_review"
              : statusOverride ?? "active";
        const listing: Listing = {
          ...input,
          id,
          ownerId: currentUser.id,
          viewCount: 0, // Y6: yeni ilan 0 görüntülenmeyle başlar (sunucuda record_listing_view ile artar)
          imageUrl: input.image,
          title: titleCheck.title,
          description: repairTurkishText(input.description),
          salesPitch: input.salesPitch.map(repairTurkishText),
          tags: input.tags.map(repairTurkishText),
          category: displayText(input.category),
          location: displayText(input.location),
          partnerRules: input.partnerRules.map(repairTurkishText),
          deliveryNote: repairTurkishText(input.deliveryNote),
          slug: `${slugify(input.title)}-${id.slice(0, 8)}`,
          status: resolvedStatus,
          partnerCount: 0,
          leadCount: 0,
          favoriteCount: 0,
          reviewCount: 0,
          createdAt: today()
        };
        if (liveUser) {
          const saved = await insertListingResult(listing);
          if (!saved.ok) {
            // Sunucunun ret nedeni kullanıcıya AYNEN gösterilir (hız sınırı, yasaklı içerik); eskiden her durumda
            // "İlan kaydedilemedi" deniyor, toplu yüklemede satır nedeni İngilizce "Listing persistence failed" çıkıyordu.
            const message = saved.code === "P0001" && saved.message
              ? saved.message
              : saved.code === "23505"
                ? "Bu harici kod (SKU) ile zaten bir ilanın var."
                : "İlan kaydedilemedi. Taslağın korundu; tekrar deneyebilirsin.";
            setAuthError(message);
            const failure = new Error(message) as Error & { code?: string };
            failure.code = saved.code;
            throw failure;
          }
          void logActivity("listing_create", { userId: currentUser.id, entityType: "listing", entityId: listing.id, metadata: { status: listing.status, category: listing.category } });
        }
        setAuthError(undefined);
        setListings((items) => [listing, ...items]);
        return listing;
      },
      async updateListing(listingId, input, publish = false) {
        const titleCheck = validateListingTitle(input.title);
        if (titleCheck.error) { setAuthError(titleCheck.error); setSyncError(titleCheck.error); return false; }
        const listing = listings.find((item) => item.id === listingId);
        if (!listing || listing.ownerId !== currentUser.id) return false;
        const updatedListing: Listing = {
          ...listing,
          ...input,
          // Düzenleme formu kademeli komisyonu sağlamıyorsa mevcut kademeleri KORU (silme).
          commissionTiers: input.partnershipMode === "none" || input.commissionType !== "rate" ? undefined : input.commissionTiers ?? listing.commissionTiers,
          imageUrl: input.image,
          title: titleCheck.title,
          description: repairTurkishText(input.description),
          salesPitch: input.salesPitch.map(repairTurkishText),
          tags: input.tags.map(repairTurkishText),
          category: displayText(input.category),
          location: displayText(input.location),
          partnerRules: input.partnerRules.map(repairTurkishText),
          deliveryNote: repairTurkishText(input.deliveryNote),
          slug: listing.slug
        };
        // Restock: stok bitince 'sold' olan ilan yeniden stoklanınca OTOMATİK aktifleşsin
        // (eskiden gizli kalıp ayrı "Aktifleştir" gerekiyordu — satıcı tuzağı). Yalnız
        // 'sold'→'active'; paused/archived/rejected kasıtlı olduğundan korunur.
        if (listing.status === "sold" && updatedListing.status === "sold" && (updatedListing.stockCount ?? 0) > 0) {
          updatedListing.status = "active";
        }
        if (publish) updatedListing.status = "active";
        if (updatedListing.status === "active" || listing.status === "rejected" || listing.status === "pending_review") {
          const scan = scanTextLocal(`${updatedListing.title}\n${updatedListing.description}`);
          updatedListing.status = scan.verdict === "block" ? "rejected" : scan.verdict === "review" || platformSettings.reviewBeforePublish ? "pending_review" : "active";
          updatedListing.rejectionReason = scan.verdict === "block" ? (scan.matched ? `Yasaklı içerik: ${scan.matched}` : "Yasaklı içerik") : undefined;
        }
        const ok = liveUser ? await updateListingLive(updatedListing) : true;
        if (!ok) {
          setAuthError("İlan güncellenemedi. Lütfen tekrar dene.");
          return false;
        }
        setAuthError(undefined);
        setListings((items) => items.map((item) => (item.id === listingId ? updatedListing : item)));
        return true;
      },
      createLead(input) {
        if (isSuspended) { setAuthError("Hesabın askıya alındığı için işlem yapamazsın."); return undefined; }
        const listing = listings.find((item) => item.id === input.listingId);
        const partnership = partnerships.find((item) => item.id === input.partnershipId && item.listingId === input.listingId);
        if (!listing || listing.status !== "active" || !partnership || partnership.status !== "active") {
          setAuthError("Talep açılamadı. İlan pasif olabilir veya ortaklık bağlantısı aktif değildir.");
          return undefined;
        }
        if (listing.ownerId === partnership.partnerId) {
          setAuthError("Satıcı kendi ilanına ortak talep açamaz.");
          return undefined;
        }
        const normalizedPhone = input.buyerPhone.replace(/\D/g, "");
        const duplicateLead = leads.some(
          (lead) =>
            lead.listingId === input.listingId &&
            lead.partnershipId === input.partnershipId &&
            lead.buyerPhone.replace(/\D/g, "") === normalizedPhone &&
            lead.status !== "lost"
        );
        if (duplicateLead) {
          setAuthError("Bu müşteri için açık talep zaten var.");
          return undefined;
        }
        const lead: Lead = { ...input, id: newId("lead", liveUser), status: "new", createdAt: today() };
        setAuthError(undefined);
        setLeads((items) => [lead, ...items]);
        // Meta Pixel: satıcı iletişimi / ortak talebi = yüksek-niyet dönüşümü (Lead). fbq yoksa no-op.
        metaTrack("Lead", { content_name: listing.title, content_category: listing.category, value: listing.price || 0, currency: "TRY" });
        setListings((items) =>
          items.map((listing) =>
            listing.id === input.listingId ? { ...listing, leadCount: listing.leadCount + 1 } : listing
          )
        );
        // Canlı modda talep bildirimleri DB tetikleyicisiyle (notify_on_lead) üretilir
        // — hem uygulama içi hem referans linki talepleri tek kaynaktan. Çift olmasın diye
        // client-side bildirimi yalnız local/demo modda gönderiyoruz.
        if (!liveUser) {
          if (listing) notify(listing.ownerId, "lead", "Yeni alıcı talebi", `${listing.title} için yeni talep geldi.`);
          notify(partnership.partnerId, "lead", "Talebin satıcıya iletildi", `${listing.title} için getirdiğin müşteri kaydedildi.`);
        }
        if (liveUser) persistCritical(insertLead(lead), () => {
          setLeads((items) => items.filter((l) => l.id !== lead.id));
          setListings((items) => items.map((l) => (l.id === input.listingId ? { ...l, leadCount: Math.max(0, l.leadCount - 1) } : l)));
          // Sunucu-taraflı tekillik (leads_listing_phone_uniq): bu müşteri bu ilan için başka bir
          // ortak tarafından ZATEN kaydedilmiş olabilir (RLS gereği istemci onu göremez).
        }, "Bu müşteri bu ilan için zaten kaydedilmiş olabilir (ilk kaydeden ortağa atanır) ya da bağlantı sorunu var. Lütfen tekrar dene.");
        return lead;
      },
      async createReview(listingId, rating, comment) {
        if (!isAuthenticated) { setAuthError("Yorum yapmak için giriş yapmalısın."); return undefined; }
        const listing = listings.find((item) => item.id === listingId);
        // Kendi ilanına yorum yasak + kullanıcı başına ilan başına tek yorum:
        // sahte 5-yıldızla reviewCount/güven/rich-result puanı şişirilmesin.
        if (!listing || listing.ownerId === currentUser.id) { setAuthError("Kendi ilanını değerlendiremezsin."); return undefined; }
        if (reviews.some((item) => item.listingId === listingId && item.reviewerId === currentUser.id && item.type === "product")) {
          setAuthError("Bu ilanı zaten değerlendirdin.");
          return undefined;
        }
        const review: Review = {
          id: newId("r", liveUser),
          listingId,
          reviewerId: currentUser.id,
          rating,
          comment,
          type: "product",
          createdAt: today()
        };
        if(!Number.isInteger(rating)||rating<1||rating>5||!comment.trim()||comment.length>1000)return undefined;
        if(liveUser&&!await insertReview(review)){setSyncError("Değerlendirme kaydedilemedi. Lütfen tekrar dene.");return undefined;}
        setReviews((items) => [review, ...items]);
        setListings((items) =>
          items.map((listing) =>
            listing.id === listingId ? { ...listing, reviewCount: listing.reviewCount + 1 } : listing
          )
        );
        // "Yorum alındı" bildirimi SUNUCUDA üretilir (reviews AFTER INSERT trigger) — istemci ayrıca yazmaz (çift bildirim olmasın).
        return review;
      },
      canReviewSale(saleId) {
        const sale = sales.find((item) => item.id === saleId);
        // Yalnızca olumlu/kapanmış satışlar yorumlanabilir; iptal/anlaşmazlık/
        // bekleyen/iade-penceresi durumları puan/güven şişirmesin.
        if (!sale || !(sale.status === "approved" || sale.status === "seller_paid" || sale.status === "paid")) return false;
        const listing = listings.find((item) => item.id === sale.listingId);
        const partnership = partnerships.find((item) => item.id === sale.partnershipId);
        const allowed = listing?.ownerId === currentUser.id || partnership?.partnerId === currentUser.id;
        const alreadyReviewed = reviews.some((item) => item.saleId === saleId && item.reviewerId === currentUser.id);
        return Boolean(allowed && !alreadyReviewed);
      },
      async createSaleReview(saleId, rating, comment, options) {
        if (!isAuthenticated) { setAuthError("Yorum yapmak için giriş yapmalısın."); return undefined; }
        const sale = sales.find((item) => item.id === saleId);
        if (!sale || !comment.trim()) return undefined;
        const listing = listings.find((item) => item.id === sale.listingId);
        const partnership = partnerships.find((item) => item.id === sale.partnershipId);
        if (!listing || !partnership) return undefined;
        const allowed = listing.ownerId === currentUser.id || partnership.partnerId === currentUser.id;
        const alreadyReviewed = reviews.some((item) => item.saleId === saleId && item.reviewerId === currentUser.id);
        if (!allowed || alreadyReviewed || !["approved","seller_paid","paid"].includes(sale.status)) return undefined;
        const reviewerIsSeller = listing.ownerId === currentUser.id;
        const review: Review = {
          id: options?.id||newId("r", liveUser),
          listingId: listing.id,
          saleId,
          reviewerId: currentUser.id,
          reviewedUserId: reviewerIsSeller ? partnership.partnerId : listing.ownerId,
          rating,
          comment: comment.trim(),
          experienceTags:options?.experienceTags,mediaPaths:options?.mediaPaths,
          type: reviewerIsSeller ? "partner" : "seller",
          createdAt: today()
        };
        if(!Number.isInteger(rating)||rating<1||rating>5||!comment.trim()||comment.length>1000)return undefined;
        if(liveUser&&!await insertReview(review)){setSyncError("Değerlendirme kaydedilemedi. Lütfen tekrar dene.");return undefined;}
        if(favoriteAccount.current!==currentUser.id)return undefined;
        setReviews((items) => [review, ...items.filter(item=>item.id!==review.id)]);
        setListings((items) => items.map((item) => (item.id === listing.id ? { ...item, reviewCount: item.reviewCount + 1 } : item)));
        // Karşı tarafa "yeni değerlendirme" bildirimi SUNUCUDA üretilir (reviews AFTER INSERT trigger) — istemci ayrıca yazmaz.
        return review;
      },
      async editReview(reviewId, rating, comment) {
        const mine = reviews.find((r) => r.id === reviewId && r.reviewerId === currentUser.id);
        if (!mine || !Number.isInteger(rating) || rating < 1 || rating > 5 || !comment.trim() || comment.trim().length > 1000) return false;
        const prev = { rating: mine.rating, comment: mine.comment };
        setReviews((items) => items.map((r) => (r.id === reviewId ? { ...r, rating, comment: comment.trim() } : r)));
        if (liveUser) {
          const ok = await editReviewLive(reviewId, rating, comment.trim());
          if (!ok) { setReviews((items) => items.map((r) => (r.id === reviewId ? { ...r, ...prev } : r))); setSyncError("Yorum güncellenemedi. Tekrar dene."); return false; }
        }
        return true;
      },
      async deleteReview(reviewId) {
        const mine = reviews.find((r) => r.id === reviewId && r.reviewerId === currentUser.id);
        if (!mine) return false;
        setReviews((items) => items.filter((r) => r.id !== reviewId));
        setListings((items) => items.map((l) => (l.id === mine.listingId ? { ...l, reviewCount: Math.max(0, l.reviewCount - 1) } : l)));
        if (liveUser) {
          const ok = await deleteReviewLive(reviewId);
          if (!ok) { setReviews((items) => [mine, ...items]); setSyncError("Yorum silinemedi. Tekrar dene."); return false; }
        }
        return true;
      },
      async reportReview(review, details) {
        // Yorum şikayeti = yorumu yazan kullanıcıyı, yorum kimliğiyle bildir (mevcut reports altyapısı).
        if (!liveUser) { setAuthError("Bildirim göndermek için e-posta ile giriş yapmalısın."); return false; }
        if (review.reviewerId === currentUser.id) return false;
        const reason = "YORUM ŞİKAYETİ";
        const note = `review=${review.id}: ${(details ?? "").trim() || review.comment.slice(0, 120)}`;
        const reportId = await insertReport({ reporterId: currentUser.id, reportedUserId: review.reviewerId, reason, details: note });
        if (reportId) setReports((items) => [{ id: reportId, reporterId: currentUser.id, reportedUserId: review.reviewerId, reason, details: note, status: "open", createdAt: today() }, ...items]);
        return Boolean(reportId);
      },
      createSaleFromLead(leadId, input) {
        if (isSuspended) { setAuthError("Hesabın askıya alındığı için işlem yapamazsın."); return undefined; }
        const lead = leads.find((item) => item.id === leadId);
        if (!lead || lead.status === "lost" || lead.status === "converted" || sales.some((sale) => sale.leadId === leadId)) return undefined;

        const listing = listings.find((item) => item.id === lead.listingId);
        const partnership = partnerships.find((item) => item.id === lead.partnershipId);
        if (!listing || listing.ownerId !== currentUser.id || listing.status !== "active" || listing.stockCount <= 0 || !partnership || partnership.status !== "active") return undefined;

        const quantity = Math.max(1, Math.floor(input?.quantity ?? 1));
        const amount = Number.isFinite(input?.amount) && Number(input?.amount) > 0 ? Number(input?.amount) : listing.price * quantity;
        const returnUntil = new Date(Date.now() + listing.returnWindowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        // Başlangıç bonusu: HER ORTAĞIN ilk `bonusQuota` satışına ek `bonusAmount` (satıcı
        // taahhüdü — reklamı yapılıyordu ama komisyona hiç eklenmiyordu, sahte vaattı). Bu
        // ortağın iptal-olmayan önceki satış sayısı kotanın altındaysa bu satışa bonus eklenir.
        const priorPartnerSales = sales.filter((s) => s.partnershipId === lead.partnershipId && s.status !== "cancelled").length;
        const bonusApplied = (listing.bonusAmount ?? 0) > 0 && (listing.bonusQuota ?? 0) > 0 && priorPartnerSales < (listing.bonusQuota ?? 0) ? Math.round(listing.bonusAmount ?? 0) : 0;
        // Efektif komisyon: per-ortak override > kademeli oran > ilan varsayılanı.
        const baseCommission = effectiveCommissionAmount(listing, partnership, priorPartnerSales, amount, quantity);
        const buyerConfirmToken = makeConfirmToken();
        const sale: Sale = {
          id: newId("s", liveUser),
          listingId: listing.id,
          partnershipId: lead.partnershipId,
          leadId: lead.id,
          amount,
          quantity,
          commissionAmount: baseCommission + bonusApplied,
          bonusApplied: bonusApplied || undefined,
          status: listing.returnWindowDays > 0 ? "return_pending" : "approved",
          buyerName: lead.buyerName,
          deliveryStatus: input?.deliveryStatus ?? "confirmed",
          returnUntil,
          approvedAt: listing.returnWindowDays > 0 ? undefined : today(),
          payoutNote: `${listing.returnWindowDays} gün iade penceresi sonrası ${listing.commissionDueDays} gün içinde dış ödeme.`,
          buyerConfirmToken,
          buyerConfirmStatus: "awaiting"
        };
        const order: Order = {
          id: newId("o", liveUser),
          listingId: listing.id,
          buyerId: currentUser.id,
          sellerId: listing.ownerId,
          partnershipId: lead.partnershipId,
          amount,
          status: "confirmed",
          createdAt: today()
        };
        setSales((items) => [sale, ...items]);
        setOrders((items) => [order, ...items]);
        setLeads((items) => items.map((item) => (item.id === leadId ? { ...item, status: "converted" } : item)));
        const nextStockCount = Math.max(0, listing.stockCount - quantity);
        const nextListingStatus = nextStockCount === 0 ? "sold" : listing.status;
        const updatedListing: Listing = { ...listing, stockCount: nextStockCount, status: nextListingStatus };
        setListings((items) => items.map((item) => (item.id === listing.id ? updatedListing : item)));
        if (partnership) notify(partnership.partnerId, "sale", "Satış kaydı oluştu", `${listing.title} için komisyon kaydı iade penceresine alındı.${bonusApplied ? ` Başlangıç bonusu ${moneyIn(bonusApplied, listing.currency)} dahil.` : ""}`, { listingId: listing.id, partnershipId: partnership.id });
        if (liveUser) persistCritical(insertSaleFromLead(sale, listing).then((ok) => { if (ok) void setBuyerConfirmToken(sale.id, buyerConfirmToken); return ok; }), () => {
          setSales((items) => items.filter((s) => s.id !== sale.id));
          setOrders((items) => items.filter((o) => o.id !== order.id));
          setLeads((items) => items.map((l) => (l.id === leadId ? lead : l)));
          setListings((items) => items.map((l) => (l.id === listing.id ? listing : l)));
        }, "Satış kaydı oluşturulamadı. Bağlantını kontrol edip tekrar dene.");
        // Stok düşümü artık record_sale RPC'sinde (atomik) — ayrı yazım YOK (çift düşüm olmasın).
        return sale;
      },
      // Doğrudan satış: ortak referans linkiyle gelen alıcı WhatsApp/elden satın
      // aldıysa (lead kaydı yoksa), satıcı satışı bu ortağa atayıp komisyonu
      // başlatır. createSaleFromLead ile aynı boru hattı; farkı lead yok.
      recordSaleForPartner(partnershipId, input) {
        if (isSuspended) { setAuthError("Hesabın askıya alındığı için işlem yapamazsın."); return undefined; }
        const partnership = partnerships.find((item) => item.id === partnershipId);
        if (!partnership || partnership.status !== "active") { setAuthError("Ortaklık aktif değil."); return undefined; }
        const listing = listings.find((item) => item.id === partnership.listingId);
        if (!listing || listing.ownerId !== currentUser.id || listing.status !== "active" || listing.stockCount <= 0) {
          setAuthError("Satış eklenemez. İlan sana ait ve aktif olmalı, stok bulunmalı.");
          return undefined;
        }

        const quantity = Math.max(1, Math.floor(input?.quantity ?? 1));
        const amount = Number.isFinite(input?.amount) && Number(input?.amount) > 0 ? Number(input?.amount) : listing.price * quantity;
        const returnUntil = new Date(Date.now() + listing.returnWindowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        // Başlangıç bonusu (ilk bonusQuota satış) — createSaleFromLead ile aynı mantık.
        const priorPartnerSales = sales.filter((s) => s.partnershipId === partnership.id && s.status !== "cancelled").length;
        const bonusApplied = (listing.bonusAmount ?? 0) > 0 && (listing.bonusQuota ?? 0) > 0 && priorPartnerSales < (listing.bonusQuota ?? 0) ? Math.round(listing.bonusAmount ?? 0) : 0;
        // Efektif komisyon: per-ortak override > kademeli oran > ilan varsayılanı.
        const baseCommission = effectiveCommissionAmount(listing, partnership, priorPartnerSales, amount, quantity);
        const sale: Sale = {
          id: newId("s", liveUser),
          listingId: listing.id,
          partnershipId: partnership.id,
          amount,
          quantity,
          commissionAmount: baseCommission + bonusApplied,
          bonusApplied: bonusApplied || undefined,
          status: listing.returnWindowDays > 0 ? "return_pending" : "approved",
          buyerName: input?.buyerName?.trim() || "Doğrudan satış",
          deliveryStatus: input?.deliveryStatus ?? "confirmed",
          returnUntil,
          approvedAt: listing.returnWindowDays > 0 ? undefined : today(),
          payoutNote: `Satıcı tarafından eklendi (doğrudan satış). ${listing.returnWindowDays} gün iade penceresi sonrası ${listing.commissionDueDays} gün içinde dış ödeme.`,
          buyerConfirmToken: makeConfirmToken(),
          buyerConfirmStatus: "awaiting"
        };
        const order: Order = {
          id: newId("o", liveUser),
          listingId: listing.id,
          buyerId: currentUser.id,
          sellerId: listing.ownerId,
          partnershipId: partnership.id,
          amount,
          status: "confirmed",
          createdAt: today()
        };
        setSales((items) => [sale, ...items]);
        setOrders((items) => [order, ...items]);
        const nextStockCount = Math.max(0, listing.stockCount - quantity);
        const nextListingStatus = nextStockCount === 0 ? "sold" : listing.status;
        const updatedListing: Listing = { ...listing, stockCount: nextStockCount, status: nextListingStatus };
        setListings((items) => items.map((item) => (item.id === listing.id ? updatedListing : item)));
        setAuthError(undefined);
        notify(partnership.partnerId, "sale", "Satış kaydı oluştu", `${listing.title} için satıcı doğrudan satış ekledi; komisyonun süreçte.${bonusApplied ? ` Başlangıç bonusu ${moneyIn(bonusApplied, listing.currency)} dahil.` : ""}`, { listingId: listing.id, partnershipId: partnership.id });
        if (liveUser) persistCritical(insertSaleFromLead(sale, listing).then((ok) => { if (ok && sale.buyerConfirmToken) void setBuyerConfirmToken(sale.id, sale.buyerConfirmToken); return ok; }), () => {
          setSales((items) => items.filter((s) => s.id !== sale.id));
          setOrders((items) => items.filter((o) => o.id !== order.id));
          setListings((items) => items.map((l) => (l.id === listing.id ? listing : l)));
        }, "Satış kaydı oluşturulamadı. Bağlantını kontrol edip tekrar dene.");
        // Stok düşümü artık record_sale RPC'sinde (atomik) — ayrı yazım YOK (çift düşüm olmasın).
        return sale;
      },
      async joinListing(listingId, input, fallbackListing) {
        const writeKey="joinListing:"+listingId;if(partnershipWrites.current.has(writeKey))return undefined;partnershipWrites.current.add(writeKey);
        try {
        // Giriş kapısı (favori/takip ile aynı): anonim kullanıcıda ortaklık yalnız yerel
        // state'te kalıyor, refCode sunucuda çözülmüyordu → hayalet ortaklık + sahte başarı.
        if (!isAuthenticated) { setAuthError("Ortak olmak için giriş yapmalısın."); return undefined; }
        if (isSuspended) { setAuthError("Hesabın askıya alındığı için işlem yapamazsın."); return undefined; }
        const listing = listings.find((item) => item.id === listingId) ?? (fallbackListing?.id === listingId ? fallbackListing : undefined);
        if (listing?.demo) { setAuthError("Bu bir örnek (vitrin) ilandır; ortaklık kapalıdır."); return undefined; }
        if (!listing || listing.ownerId === currentUser.id || listing.status !== "active") {
          setAuthError("Bu ilana ortak olunamaz. İlan pasif olabilir veya kendi ilanın olabilir.");
          return undefined;
        }
        // NORMAL İLAN (ortak satışa kapalı): ortaklık talebi alınmaz.
        if (listing.partnershipMode === "none") {
          setAuthError("Bu ilan normal ilandır; ortak satışa açık değildir.");
          return undefined;
        }
        const invited = listing.partnershipMode === "invite" && input?.inviteCode === listingInviteCode(listing);
        if (listing.partnershipMode === "invite" && !invited) {
          setAuthError("Bu ilan sadece davetle ortaklığa açıktır. Ortak olmak için satıcıdan davet linki iste.");
          return undefined;
        }
        // Yeni kullanıcının puanı 0'dır (henüz yorum yok). 0'ı "yetersiz puan" sayıp
        // herkesi engellemek yerine yalnızca gerçekten puanlanmış (rating>0) ve eşiğin
        // altındaki ortakları eleriz — aksi halde hiçbir yeni kullanıcı ortak olamıyordu.
        if (currentUser.rating > 0 && currentUser.rating < listing.minPartnerRating) {
          setAuthError(`Bu ilan için en az ${listing.minPartnerRating} ortak puanı gerekiyor.`);
          return undefined;
        }

        if (!listings.some((item) => item.id === listingId)) setListings((items) => items.some((item) => item.id === listingId) ? items : [...items, listing]);
        const existing = partnerships.find(
          (item) => item.listingId === listingId && item.partnerId === currentUser.id
        );
        // Mevcut ortaklık varsa: YENİDEN AÇILABİLİR mi?
        //  • rejected (satıcı reddetti) / cancelled (ortak KENDİ ayrıldı) / completed (bitti)
        //    → yeniden başvurulabilir; DB'de (listing_id, partner_id) benzersiz olduğundan yeni
        //    satır insert edilemez → partner_join mevcut satırı günceller (şartları o anki
        //    ilandan TAZELER).
        //  • blocked → satıcı engelledi: TERMİNAL. Eskiden buraya düşüp sessizce "başarı"
        //    dönüyordu (kullanıcı ortak olduğunu sanıyor, link asla atıf yapmıyordu).
        //  • active/pending → zaten içeride, aynen dön.
        const REOPENABLE: Partnership["status"][] = ["rejected", "cancelled", "completed"];
        if (existing && existing.status === "blocked") {
          setAuthError("Bu satıcı seni bu ilan için engelledi. Ortak olamazsın.");
          return undefined;
        }
        if (existing && !REOPENABLE.includes(existing.status)) {
          setAuthError(undefined);
          return existing;
        }
        if (existing && REOPENABLE.includes(existing.status)) {
          const reopenStatus = listing.partnershipMode === "open" || invited ? "active" : "pending";
          const reopened: Partnership = {
            ...existing,
            status: reopenStatus,
            rejectionReason: undefined,
            note: input?.note?.trim() || existing.note,
            shareChannel: input?.shareChannel?.trim() || existing.shareChannel,
            audience: input?.audience?.trim() || existing.audience,
            platformHandle: input?.platformHandle?.trim() || existing.platformHandle,
            reachEstimate: Number.isFinite(input?.reachEstimate) ? Math.max(0, Number(input?.reachEstimate)) : existing.reachEstimate,
            approvedAt: reopenStatus === "active" ? today() : existing.approvedAt
          };
          if(liveUser&&!await partnerJoinLive(reopened,input?.inviteCode)){setAuthError("Başvuru kaydedilemedi. Kontenjanı ve bağlantını kontrol edip tekrar dene.");return undefined;}
          if(favoriteAccount.current!==currentUser.id)return undefined;
          setPartnerships((items) => items.map((p) => (p.id === existing.id ? reopened : p)));
          setAuthError(undefined);
          if (reopened.status === "active") {
            setListings((items) => items.map((item) => (item.id === listingId ? { ...item, partnerCount: item.partnerCount + 1 } : item)));
          } else {
            notify(listing.ownerId, "application", "Yeni ortak başvurusu", `${currentUser.name}, ${listing.title} ilanına yeniden başvurdu.`, { listingId: listing.id, partnershipId: reopened.id });
          }
          // Reopen ORTAK tarafından yapılır; partnerships UPDATE RLS'i yalnız sahibe izin
          // verir → SUNUCU RPC'si (partner_join) reddedileni yeniden açar + invite doğrular.
        return reopened;
        }

        const status = listing.partnershipMode === "open" || invited ? "active" : "pending";
        const partnership: Partnership = {
          id: newId("p", liveUser),
          listingId,
          partnerId: currentUser.id,
          refCode: makeRefCode(currentUser.id, listingId),
          status,
          // Uydurma varsayılan metin YOK (sahte veri yasağı). Anında (open) ortaklıkta
          // satıcı onayı olmadığından bu alanlar boş kalabilir; başvuru formu doldurunca dolar.
          note: input?.note?.trim() || "",
          shareChannel: input?.shareChannel?.trim() || "",
          audience: input?.audience?.trim() || "",
          platformHandle: input?.platformHandle?.trim() || "",
          reachEstimate: Number.isFinite(input?.reachEstimate) ? Math.max(0, Number(input?.reachEstimate)) : 0,
          approvedAt: status === "active" ? today() : undefined,
          createdAt: today()
        };
        const proposedId=partnership.id;
        if(liveUser&&!await partnerJoinLive(partnership,input?.inviteCode)){setAuthError("Ortaklık kaydedilemedi. Kontenjanı ve bağlantını kontrol edip tekrar dene.");return undefined;}
        if(favoriteAccount.current!==currentUser.id)return undefined;
        setPartnerships((items) => [partnership, ...items.filter(p=>p.id!==partnership.id)]);
        setAuthError(undefined);
        if (partnership.status === "active" && partnership.id===proposedId) {
          setListings((items) =>
            items.map((item) => (item.id === listingId ? { ...item, partnerCount: item.partnerCount + 1 } : item))
          );
        } else if(partnership.status==="pending") {
          notify(listing.ownerId, "application", "Yeni ortak başvurusu", `${currentUser.name}, ${listing.title} ilanına başvurdu.`, { listingId: listing.id, partnershipId: partnership.id });
        }
        // Katılım SUNUCU RPC'siyle: invite kodu SQL'de doğrulanır, onay modu 'pending'e
        // düşer (istemci hilesi geçmez), açık mod anında aktif. Trigger doğrudan-POST bypass'ı kapatır.
        return partnership;
        } finally {partnershipWrites.current.delete(writeKey);}
      },
      async approvePartnership(partnershipId) {
        const writeKey="decision:"+partnershipId;if(partnershipWrites.current.has(writeKey))return false;partnershipWrites.current.add(writeKey);
        try {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || (listing.ownerId !== currentUser.id && !staff) || partnership.status !== "pending") return false;
        const updatedPartnership: Partnership = { ...partnership, status: "active", approvedAt: today() };
        if(liveUser&&!await updatePartnershipStatus(updatedPartnership)){setSyncError("Başvuru onayı kaydedilemedi. Kontenjanı kontrol edip tekrar dene.");return false;}
        if(favoriteAccount.current!==currentUser.id)return false;
        setPartnerships((items) => items.map((item) => (item.id === partnershipId ? updatedPartnership : item)));
        setListings((items) =>
          items.map((listing) =>
            listing.id === partnership.listingId ? { ...listing, partnerCount: listing.partnerCount + 1 } : listing
          )
        );
        notify(partnership.partnerId, "application", "Ortaklık kabul edildi", `${listing.title} için ortaklığın aktif. Satıcıyla iletişim kurarak satışa katkı sağlayabilirsin.`, { listingId: listing.id, partnershipId: partnership.id });
        return true;
        } finally {partnershipWrites.current.delete(writeKey);}
      },
      async rejectPartnership(partnershipId, reason) {
        const writeKey="decision:"+partnershipId;if(partnershipWrites.current.has(writeKey))return false;partnershipWrites.current.add(writeKey);
        try {
        const partnership = partnerships.find((item) => item.id === partnershipId);
        const listing = partnership ? listings.find((item) => item.id === partnership.listingId) : undefined;
        if (!partnership || !listing || (listing.ownerId !== currentUser.id && !staff) || partnership.status !== "pending") return false;
        const cleanReason = reason?.trim() || "Satıcı bu başvuruyu uygun görmedi.";
        const updatedPartnership = partnership
          ? { ...partnership, status: "rejected" as const, rejectionReason: cleanReason }
          : undefined;
        if(liveUser&&updatedPartnership&&!await updatePartnershipStatus(updatedPartnership)){setSyncError("Başvuru reddi kaydedilemedi. Tekrar dene.");return false;}
        if(favoriteAccount.current!==currentUser.id)return false;
        setPartnerships((items) =>
          items.map((item) => (item.id === partnershipId && updatedPartnership ? updatedPartnership : item))
        );
        if (partnership) notify(partnership.partnerId, "application", "Ortaklık reddedildi", cleanReason, { listingId: listing.id, partnershipId: partnership.id });
        return true;
        } finally {partnershipWrites.current.delete(writeKey);}
      },
      // Aktif ortaklığı satıcı sonlandırır/kapatır (eski hâlde bir kez onaylanan ortak
      // — sızan davet linkiyle gelen dahil — kalıcıydı). "cancelled": normal sonlandırma,
      // "blocked": kötüye kullanım engeli. Paylaşım linki artık lead getirmez.
      async endPartnership(partnershipId, mode = "cancelled") {
        const partnership = partnerships.find(item => item.id === partnershipId);
        const listing = partnership ? listings.find(item => item.id === partnership.listingId) : undefined;
        if (!isAuthenticated || !partnership || !listing || (listing.ownerId !== currentUser.id && !staff) || partnership.status !== "active") return false;
        const key="decision:"+partnershipId;if(partnershipWrites.current.has(key))return false;partnershipWrites.current.add(key);
        try {
          const updated:Partnership={...partnership,status:mode};
          if(liveUser&&!await updatePartnershipStatus(updated)){setSyncError("Ortaklık güncellenemedi. Tekrar dene.");return false;}
          if(favoriteAccount.current!==currentUser.id)return false;
          setSyncError(null);
          setPartnerships(items=>items.map(p=>p.id===partnershipId?updated:p));
          setListings(items=>items.map(l=>l.id===listing.id?{...l,partnerCount:Math.max(0,l.partnerCount-1)}:l));
          notify(partnership.partnerId,"application",mode==="blocked"?"Ortaklık kapatıldı":"Ortaklık sonlandırıldı",`${listing.title} için ortaklığın satıcı tarafından sonlandırıldı.`,{listingId:listing.id,partnershipId});
          return true;
        }catch{setSyncError("Ortaklık güncellenemedi. Tekrar dene.");return false;}finally{partnershipWrites.current.delete(key);}
      },
      async leavePartnership(partnershipId) {
        const partnership=partnerships.find(item=>item.id===partnershipId);
        if(!isAuthenticated||!partnership||partnership.partnerId!==currentUser.id||partnership.status!=="active")return false;
        const key="decision:"+partnershipId;if(partnershipWrites.current.has(key))return false;partnershipWrites.current.add(key);
        try{
          if(liveUser&&!await leavePartnershipLive(partnershipId)){setSyncError("Ortaklıktan ayrılınamadı. Tekrar dene.");return false;}
          if(favoriteAccount.current!==currentUser.id)return false;
          setSyncError(null);
          setPartnerships(items=>items.map(p=>p.id===partnershipId?{...p,status:"cancelled"}:p));
          setListings(items=>items.map(l=>l.id===partnership.listingId?{...l,partnerCount:Math.max(0,l.partnerCount-1)}:l));
          const listing=listings.find(l=>l.id===partnership.listingId);
          if(listing)notify(listing.ownerId,"application","Ortak ayrıldı",`${currentUser.name}, ortaklıktan ayrıldı.`,{listingId:listing.id,partnershipId});
          return true;
        }catch{setSyncError("Ortaklıktan ayrılınamadı. Tekrar dene.");return false;}finally{partnershipWrites.current.delete(key);}
      },
      async setPartnershipCommission(partnershipId,type,value) {
        const partnership=partnerships.find(item=>item.id===partnershipId),listing=partnership?listings.find(l=>l.id===partnership.listingId):undefined;
        if(!isAuthenticated||!partnership||!listing||(listing.ownerId!==currentUser.id&&!staff))return false;
        const clear=type===undefined&&value===undefined;
        if(!clear&&(!type||!Number.isFinite(value)||Number(value)<=0||type==="rate"&&Number(value)>90))return false;
        const key="decision:"+partnershipId;if(partnershipWrites.current.has(key))return false;partnershipWrites.current.add(key);
        const nextType=clear?undefined:type,nextValue=clear?undefined:Math.round(Number(value)*100)/100;
        try{
          if(liveUser&&!await setPartnershipCommissionLive(partnershipId,nextType??null,nextValue??null)){setSyncError("Komisyon güncellenemedi. Tekrar dene.");return false;}
          if(favoriteAccount.current!==currentUser.id)return false;
          setSyncError(null);
          setPartnerships(items=>items.map(p=>p.id===partnershipId?{...p,commissionOverrideType:nextType,commissionOverrideValue:nextValue}:p));
          return true;
        }catch{setSyncError("Komisyon güncellenemedi. Tekrar dene.");return false;}finally{partnershipWrites.current.delete(key);}
      },
      // Koleksiyon (favori-klasör) ata/kaldır — favori zaten ekliyse. null → "Tümü"ne düşer.
      setFavoriteCollection(listingId, collection) {
        if (!isAuthenticated) { promptLogin(); return; }
        const existing = favorites.find((item) => item.listingId === listingId && item.userId === currentUser.id);
        if (!existing) return;
        const col = collection && collection.trim() ? collection.trim() : undefined;
        setFavorites((items) => items.map((item) => (item.id === existing.id ? { ...item, collection: col } : item)));
        if (liveUser) persistCritical(updateFavoriteCollection(listingId, currentUser.id, col ?? null), () => setFavorites(items => items.map(item => item.id === existing.id ? existing : item)), "Koleksiyon kaydedilemedi. Tekrar dene.");
      },
      toggleFavorite(listingId) {
        // Anon: sessiz no-op yerine /auth'a yönlendir (iletişim/ortak akışlarıyla parite).
        if (!isAuthenticated) { promptLogin(); return; }
        const writeKey = `${currentUser.id}:${listingId}`;
        if (favoriteWrites.current.has(writeKey)) return;
        const favoriteUser = favoriteAccount.current;
        haptic.light();
        const existing = favorites.find((item) => item.listingId === listingId && item.userId === currentUser.id);
        if (existing) {
          setFavorites((items) => items.filter((item) => item.id !== existing.id));
          setListings((items) =>
            items.map((listing) =>
              listing.id === listingId ? { ...listing, favoriteCount: Math.max(0, listing.favoriteCount - 1) } : listing
            )
          );
          if (liveUser) {
            favoriteWrites.current.add(writeKey);
            persistCritical(deleteFavorite(listingId, currentUser.id).finally(() => favoriteWrites.current.delete(writeKey)), () => {
              if (favoriteAccount.current !== favoriteUser) return;
              setFavorites(items => items.some(f => f.id === existing.id) ? items : [existing,...items]);
              setListings(items => items.map(l => l.id === listingId ? { ...l, favoriteCount: l.favoriteCount + 1 } : l));
            }, "Favori kaldırılamadı. Tekrar dene.");
          }
          return;
        }
        const favoriteId = newId("f", liveUser);
        const favListing = listings.find((l) => l.id === listingId);
        const savedPrice = favListing?.price;
        setFavorites((items) => [{ id: favoriteId, listingId, userId: currentUser.id, savedPrice, createdAt: new Date().toISOString() }, ...items]);
        // Meta Pixel: favoriye ekleme = ilgi sinyali (AddToWishlist). fbq yoksa no-op.
        metaTrack("AddToWishlist", { content_name: favListing?.title, content_category: favListing?.category, value: favListing?.price || 0, currency: "TRY" });
        setListings((items) =>
          items.map((listing) =>
            listing.id === listingId ? { ...listing, favoriteCount: listing.favoriteCount + 1 } : listing
          )
        );
        if (liveUser) {
          favoriteWrites.current.add(writeKey);
          persistCritical(insertFavorite(listingId, currentUser.id, favoriteId, savedPrice).finally(() => favoriteWrites.current.delete(writeKey)), () => {
            if (favoriteAccount.current !== favoriteUser) return;
            setFavorites(items => items.filter(f => f.id !== favoriteId));
            setListings(items => items.map(l => l.id === listingId ? { ...l, favoriteCount: Math.max(0,l.favoriteCount-1) } : l));
          }, "Favori kaydedilemedi. Tekrar dene.");
        }
      },
      followedSellerIds,
      isFollowing(sellerId) {
        return followedSellerIds.includes(sellerId);
      },
      toggleFollow(sellerId) {
        if (!isAuthenticated) { setAuthError("Mağaza takibi için giriş yapmalısın."); return; }
        if (sellerId === currentUser.id) return;
        const following = followedSellerIds.includes(sellerId);
        // İyimser güncelleme: takip listesi + satıcının followerCount'u (kart/başlık) anında.
        const bumpFollower = (delta: number) => setUsers((items) => items.map((u) => (u.id === sellerId ? { ...u, followerCount: Math.max(0, u.followerCount + delta) } : u)));
        if (following) {
          setFollowedSellerIds((ids) => ids.filter((id) => id !== sellerId));
          bumpFollower(-1);
          if (liveUser) persistCritical(unfollowSellerLive(sellerId), () => { setFollowedSellerIds((ids) => (ids.includes(sellerId) ? ids : [...ids, sellerId])); bumpFollower(1); }, "Takip bırakılamadı. Bağlantını kontrol edip tekrar dene.");
        } else {
          setFollowedSellerIds((ids) => (ids.includes(sellerId) ? ids : [...ids, sellerId]));
          bumpFollower(1);
          if (liveUser) persistCritical(followSellerLive(sellerId), () => { setFollowedSellerIds((ids) => ids.filter((id) => id !== sellerId)); bumpFollower(-1); }, "Takip edilemedi. Bağlantını kontrol edip tekrar dene.");
        }
      },
      offers,
      async createOffer(listingId, sellerId, amount, note) {
        if (!isAuthenticated) { setAuthError("Teklif vermek için giriş yapmalısın."); return { ok: false, error: "Giriş gerekli." }; }
        if (sellerId === currentUser.id) return { ok: false, error: "Kendi ilanına teklif veremezsin." };
        if (!(amount > 0)) return { ok: false, error: "Geçerli bir tutar gir." };
        const res = await createOfferLive({ listingId, sellerId, amount, note });
        if (res.ok) { const rows = await fetchOffersResultLive(); if (rows) setOffers(rows); } // sunucudan tazele (id/created_at gerçek); okuma başarısızsa eldekini EZME
        return res;
      },
      // SATICI: kabul / ret / karşı teklif. Durum geçişini SUNUCU zorlar (RPC).
      async sellerRespondOffer(offerId, action, counterAmount) {
        const ok = await offerSellerRespondLive(offerId, action, counterAmount);
        if (!ok) { setSyncError("Teklif yanıtlanamadı. Tekrar dene."); return false; }
        { const rows = await fetchOffersResultLive(); if (rows) setOffers(rows); } // gerçek durum/tutar sunucudan; okuma başarısızsa eldekini EZME
        return true;
      },
      // ALICI: geri çek, ya da karşı teklifi kabul/ret. Kabul edilirse anlaşma tutarını
      // SUNUCU yazar (counter_amount) — istemci tutar gönderemez.
      async buyerOfferAction(offerId, action) {
        const ok = await offerBuyerActionLive(offerId, action);
        if (!ok) { setSyncError("İşlem yapılamadı. Tekrar dene."); return false; }
        { const rows = await fetchOffersResultLive(); if (rows) setOffers(rows); }
        return true;
      },
      blockedUserIds,
      isUserBlocked(userId) {
        return blockedUserIds.includes(userId);
      },
      async blockUser(userId,reason) {
        if (!isAuthenticated) { setAuthError("Engellemek için giriş yapmalısın."); return false; }
        if (userId === currentUser.id) return false;
        if (blockedUserIds.includes(userId)) return true;
        if(liveUser&&!await blockUserLive(userId,reason)){setSyncError("Engellenemedi. Tekrar dene.");return false;}
        if(favoriteAccount.current!==currentUser.id)return false;
        setBlockedUserIds((ids) => [...ids, userId]);
        return true;
      },
      async unblockUser(userId) {
        if(!isAuthenticated)return false;
        if (!blockedUserIds.includes(userId)) return true;
        if(liveUser&&!await unblockUserLive(userId)){setSyncError("Engel kaldırılamadı. Tekrar dene.");return false;}
        if(favoriteAccount.current!==currentUser.id)return false;
        setBlockedUserIds((ids) => ids.filter((id) => id !== userId));
        return true;
      },
      startConversation(listingId, receiverId, body, fallbackListing) {
        return createOrReuseConversation(listingId, receiverId, body, fallbackListing);
      },
      sendMessage(listingId, receiverId, body) {
        createOrReuseConversation(listingId, receiverId, body);
      },
      sendConversationMessage(conversationId, body, attachment) {
        if (!isAuthenticated) { setAuthError("Mesaj göndermek için giriş yapmalısın."); return false; }
        // Reddedilen durumlarda FALSE dön → çağıran metni geri yükler (sessiz kayıp yok).
        if (isSuspended) { setSyncError("Hesabın askıya alındığı için mesaj gönderemezsin."); return false; }
        const trimmed = body.trim();
        if (!trimmed && !attachment) return false;
        // Spam koruması: aynı cihazdan aşırı mesaj gönderimini anında engelle.
        if (!rateLimitSync("message_send")) { setSyncError("Çok hızlı mesaj gönderiyorsun. Lütfen biraz yavaşla."); return false; }
        haptic.light();
        const conversation = conversations.find((item) => item.id === conversationId);
        // Kapalı/geçersiz görüşmede de sebep göster (eskiden sessizce false → gönder dokunuşu ölüydü).
        if (!conversation || conversation.status !== "open") { setSyncError("Bu görüşme kapalı — mesaj gönderilemiyor."); return false; }
        const receiverId = conversation.participantIds.find((id) => id !== currentUser.id);
        if (!receiverId) { setSyncError("Alıcı bulunamadı — görüşme geçersiz."); return false; }
        const message: Message = {
          id: newId("m", liveUser),
          conversationId,
          listingId: conversation.listingId,
          senderId: currentUser.id,
          receiverId,
          body: trimmed,
          // Yerel saat + saniye hassasiyeti — aynı dakikadaki mesajların sırası korunur.
          createdAt: msgStamp(),
          read: false,
          attachmentUrl: attachment?.url,
          attachmentType: attachment?.type,
          attachmentName: attachment?.name
        };
        setMessages((items) => [message, ...items]);
        setConversations((items) => items.map((item) => (item.id === conversationId ? { ...item, lastMessageAt: message.createdAt } : item)));
        // Mesaj DB'ye yazılamazsa (bağlantı/RLS) baloncuğu SİLME → "failed" işaretle
        // ki kullanıcı görsün ve "tekrar dene" ile yeniden gönderebilsin (kayıp yok).
        // Alıcı bildirimi (doğru sohbeti açan metadata ile) yalnız yazım başarılıysa gider.
        deliverMessage(message);
        return true;
      },
      retryMessage(messageId) {
        const msg = messages.find((m) => m.id === messageId && m.status === "failed");
        if (!msg) return;
        // "failed" işaretini kaldır (yeniden gönderiliyor) → başarısızsa tekrar işaretlenir.
        setMessages((items) => items.map((m) => (m.id === messageId ? { ...m, status: undefined } : m)));
        if (liveUser) deliverMessage({ ...msg, status: undefined });
      },
      markConversationRead(conversationId) {
        const unread = messages.filter((item) => item.conversationId === conversationId && item.receiverId === currentUser.id && !item.read);
        setMessages((items) => items.map((item) => (item.conversationId === conversationId && item.receiverId === currentUser.id ? { ...item, read: true } : item)));
        // TEK istek (eskiden mesaj başına ayrı UPDATE → N istek + tutarsız sayaç titremesi).
        if (liveUser && unread.length) void markConversationReadLive(conversationId, currentUser.id);
      },
      async markNotificationRead(notificationId) {
        const notification = notifications.find(item => item.id === notificationId && item.userId === currentUser.id);
        if (!notification) return false;
        if (notification.read || notificationWrites.current.has(notificationId)) return true;
        notificationWrites.current.add(notificationId);
        setNotifications(items => items.map(item => item.id === notificationId ? { ...item, read: true } : item));
        try {
          const ok = !liveUser || await markNotificationReadLive(notification);
          if (!ok && favoriteAccount.current === currentUser.id) setNotifications(items => items.map(item => item.id === notificationId && item.userId === currentUser.id ? { ...item, read: false } : item));
          return ok;
        } finally { notificationWrites.current.delete(notificationId); }
      },
      // "Tümünü okundu işaretle": TEK istek (eskiden bildirim başına ayrı UPDATE → N istek). İyimser:
      // satırlar hemen okundu görünür; sunucu reddederse YALNIZ bu çağrının çevirdiği satırlar geri alınır.
      async markAllNotificationsRead() {
        const uid = currentUser.id;
        const ids = new Set(notifications.filter(item => item.userId === uid && !item.read && !notificationWrites.current.has(item.id)).map(item => item.id));
        if (!ids.size) return true;
        ids.forEach(id => notificationWrites.current.add(id)); // araya giren yenileme iyimser durumu ezmesin
        setNotifications(items => items.map(item => ids.has(item.id) ? { ...item, read: true } : item));
        try {
          const ok = !liveUser || await markAllNotificationsReadLive(uid);
          if (!ok && favoriteAccount.current === uid) setNotifications(items => items.map(item => ids.has(item.id) && item.userId === uid ? { ...item, read: false } : item));
          return ok;
        } finally { ids.forEach(id => notificationWrites.current.delete(id)); }
      },
      async refreshNotifications() {
        if (!liveUser) return;
        const uid = currentUser.id;
        const rows = await fetchUserNotifications(uid);
        if (favoriteAccount.current !== uid) return;
        setNotifications(rows.map(n => notificationWrites.current.has(n.id) ? { ...n, read: true } : n));
      },
      categorySuggestions,
      locationSuggestions,
      addCategorySuggestion(input) {
        const suggestion: CategorySuggestion = { id: newId("cs", liveUser), userId: currentUser.id, userName: currentUser.name, suggestedPath: input.suggestedPath, note: input.note, listingId: input.listingId, status: "pending", createdAt: today() };
        setCategorySuggestions((items) => [suggestion, ...items]);
        // Öneri DB'ye yazılamazsa geri al + hata göster (kullanıcı "gönderildi" sanıp
        // önerisini kaybetmesin).
        if (liveUser) persistCritical(insertCategorySuggestion(suggestion), () => {
          setCategorySuggestions((items) => items.filter((s) => s.id !== suggestion.id));
        }, "Öneri gönderilemedi. Lütfen tekrar dene.");
      },
      addLocationSuggestion(input) {
        const suggestion: LocationSuggestion = { id: newId("ls", liveUser), userId: currentUser.id, userName: currentUser.name, provinceId: input.provinceId, districtId: input.districtId, suggestedName: input.suggestedName, type: "neighborhood", note: input.note, status: "pending", createdAt: today() };
        setLocationSuggestions((items) => [suggestion, ...items]);
        if (liveUser) persistCritical(insertLocationSuggestion(suggestion), () => {
          setLocationSuggestions((items) => items.filter((s) => s.id !== suggestion.id));
        }, "Öneri gönderilemedi. Lütfen tekrar dene.");
      },
      async setCategorySuggestionStatus(id, status) {
        const prev = categorySuggestions.find((item) => item.id === id)?.status;
        if (!prev) return false;
        setCategorySuggestions((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
        if (!liveUser) return true;
        const ok = await settleWrite(updateCategorySuggestionStatusLive(id, status, currentUser.id));
        if (!ok) setCategorySuggestions((items) => items.map((item) => (item.id === id ? { ...item, status: prev } : item)));
        return ok;
      },
      async setLocationSuggestionStatus(id, status) {
        const prev = locationSuggestions.find((item) => item.id === id)?.status;
        if (!prev) return false;
        setLocationSuggestions((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
        if (!liveUser) return true;
        const ok = await settleWrite(updateLocationSuggestionStatusLive(id, status, currentUser.id));
        if (!ok) setLocationSuggestions((items) => items.map((item) => (item.id === id ? { ...item, status: prev } : item)));
        return ok;
      },
      updateLeadStatus(leadId, status) {
        const lead = leads.find((item) => item.id === leadId);
        const listing = lead ? listings.find((item) => item.id === lead.listingId) : undefined;
        // Satıcı (ilan sahibi) VEYA lead'i getiren ortak durumu güncelleyebilir.
        // (Ortak yalnızca status değiştirebilir — DB trigger'ı kolon-korumalı.)
        const leadPartnership = lead?.partnershipId ? partnerships.find((p) => p.id === lead.partnershipId) : undefined;
        const canManage = !!listing && (listing.ownerId === currentUser.id || leadPartnership?.partnerId === currentUser.id);
        if (!lead || !listing || !canManage) return;
        // Satışa DÖNMÜŞ lead'in durumu değiştirilemez: 'converted'ı 'lost' yapmak hem yanlış
        // etiketler ("Kayıp") hem de (listing,phone) dedup slotunu boşaltıp aynı alıcıya mükerrer
        // lead açılmasına izin verir. (Buton seller.tsx'te de gizlenir — burası sunucu-taraf kilit.)
        if (lead.status === "converted" || sales.some((s) => s.leadId === leadId)) {
          setSyncError("Bu müşteri satışa döndü; durumu değiştirilemez.");
          return;
        }
        const prevStatus = lead.status;
        setLeads((items) => items.map((item) => (item.id === leadId ? { ...item, status } : item)));
        // Sunucu yazımı başarısızsa optimistik değişikliği GERİ AL + hata göster (eskiden
        // fire-and-forget'ti → UI yeni durumu gösterip DB eskide kalıyor, yenilemede sessiz sapıyordu).
        if (liveUser) persistCritical(updateLeadStatusLive({ ...lead, status }), () => {
          setLeads((items) => items.map((item) => (item.id === leadId ? { ...item, status: prevStatus } : item)));
        }, "Müşteri durumu güncellenemedi. Bağlantını kontrol edip tekrar dene.");
      },
      async updateListingStatus(listingId, status) {
        const listing = listings.find(item => item.id === listingId);
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isAuthenticated || !listing || (listing.ownerId !== currentUser.id && !isStaff)) return false;
        if (!isStaff && (listing.status === "pending_review" || listing.status === "rejected") && status === "active") {
          setAuthError("Bu ilan incelemede. Yayına alınması için admin onayı gerekir."); return false;
        }
        let resolvedStatus = status;
        if (!isStaff && status === "active") {
          const scan = scanTextLocal(`${listing.title}\n${listing.description}`);
          if (scan.verdict === "block") { setAuthError("Bu içerik yayınlanamıyor. Önce ilanını düzenle."); return false; }
          if (scan.verdict === "review" || platformSettings.reviewBeforePublish) resolvedStatus = "pending_review";
        }
        try {
          if (liveUser && !await updateListingStatusLive({ ...listing, status: resolvedStatus })) {
            setAuthError("İlan durumu kaydedilemedi. Tekrar deneyebilirsin."); return false;
          }
          setListings(items => items.map(item => item.id === listingId ? { ...item, status: resolvedStatus } : item));
          setAuthError(undefined); return true;
        } catch { setAuthError("Bağlantı kurulamadı. İlan durumu korunuyor."); return false; }
      },
      updateListingInventory(listingId, patch) {
        const listing = listings.find((item) => item.id === listingId);
        // Yalnız ilan sahibi satır-içi stok/fiyat düzenleyebilir.
        if (!listing || listing.ownerId !== currentUser.id) return;
        const nextStock = typeof patch.stockCount === "number" ? Math.max(0, Math.floor(patch.stockCount)) : undefined;
        const nextPrice = typeof patch.price === "number" ? Math.max(0, Math.round(patch.price)) : undefined;
        if (nextStock === undefined && nextPrice === undefined) return;
        // Restock: satılan (stok-biten) ilan satır-içi stok>0 ile aktifleşsin (full-edit ile parite).
        const reactivate = listing.status === "sold" && nextStock !== undefined && nextStock > 0;
        const prev = { stockCount: listing.stockCount, price: listing.price, status: listing.status };
        setListings((items) =>
          items.map((item) =>
            item.id === listingId
              ? {
                  ...item,
                  ...(nextStock !== undefined ? { stockCount: nextStock } : {}),
                  ...(nextPrice !== undefined ? { price: nextPrice } : {}),
                  ...(reactivate ? { status: "active" as const } : {})
                }
              : item
          )
        );
        if (liveUser) {
          persistCritical(
            updateListingStockPriceLive(listingId, { stockCount: nextStock, price: nextPrice }),
            () => {
              setListings((items) =>
                items.map((item) => (item.id === listingId ? { ...item, ...prev } : item))
              );
            },
            "Güncelleme kaydedilemedi. Bağlantını kontrol edip tekrar dene."
          );
          // Reaktivasyon status'u ayrı yazılır (stok RPC'si status yazmaz).
          if (reactivate) persistOrWarn(updateListingStatusLive({ ...listing, status: "active" }), "İlan durumu güncellenemedi. Lütfen tekrar dene.");
        }
      },
      // Admin aksiyonları GERÇEK sonucu döndürür (true/false): iyimser uygula → canlı yazımı bekle →
      // başarısızsa GERİ AL + false. Sonucu çağıran gösterir (admin run()); ayrıca syncError yazılmaz.
      async setListingFeatured(listingId, featured) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return false;
        const prev = listings.find((item) => item.id === listingId)?.featured;
        setListings((items) => items.map((item) => (item.id === listingId ? { ...item, featured } : item)));
        if (!liveUser) return true;
        const ok = await settleWrite(updateListingFeaturedLive(listingId, featured));
        if (!ok) setListings((items) => items.map((item) => (item.id === listingId ? { ...item, featured: prev } : item)));
        return ok;
      },
      // Kalıcı silme SUNUCU-OTORİTELİ (remove_listing RPC; sahip + admin/moderatör): düz DELETE,
      // komisyon/sipariş FK'si (NO ACTION) olan ilanda patlıyor, ortaklık/talep geçmişini de CASCADE ile
      // sessizce siliyordu. Sonuç önceden bilinemediği için yerel durum YANITTAN SONRA uygulanır.
      async deleteListing(listingId, onOutcome) {
        const listing = listings.find((item) => item.id === listingId);
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!listing || (listing.ownerId !== currentUser.id && !isStaff)) return false;
        let result: "deleted" | "archived" | false = "deleted"; // demo/canlı-değil: yerel silme
        if (liveUser) { try { result = await removeListingLive(listingId); } catch { result = false; } }
        if (result === false) return false;
        if (result === "archived") {
          setListings((items) => items.map((item) => (item.id === listingId ? { ...item, status: "archived" as const } : item)));
          setPartnerships((items) => items.map((p) => (p.listingId === listingId && p.status === "active" ? { ...p, status: "cancelled" as const } : p)));
        } else setListings((items) => items.filter((item) => item.id !== listingId));
        onOutcome?.(result);
        return true;
      },
      // Kullanıcı ilan silme (sahip). Finansal/ilişki geçmişi olan ilan hard-delete EDİLMEZ →
      // arşivlenir (gizlenir, geçmiş korunur). Temiz ilan gerçekten silinir. Sunucu da FK
      // hatasında arşive düşer (removeListingLive) → istemci geçmişi eksik bilse bile para kaybı olmaz.
      async removeListing(listingId) {
        const listing = listings.find(item => item.id === listingId);
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isAuthenticated || !listing || (listing.ownerId !== currentUser.id && !isStaff)) return false;
        const hasHistory = partnerships.some(p => p.listingId === listingId) || leads.some(l => l.listingId === listingId) || sales.some(s => s.listingId === listingId);
        try {
          const result = liveUser ? await removeListingLive(listingId) : hasHistory ? "archived" : "deleted";
          if (result === false) { setAuthError("İlan kaldırılamadı. Kaydın korunuyor; tekrar deneyebilirsin."); return false; }
          if (result === "archived") {
            setListings(items => items.map(item => item.id === listingId ? { ...item, status: "archived" as const } : item));
            setPartnerships(items => items.map(p => p.listingId === listingId && p.status === "active" ? { ...p, status: "cancelled" as const } : p));
          } else setListings(items => items.filter(item => item.id !== listingId));
          setAuthError(undefined); return true;
        } catch { setAuthError("Bağlantı kurulamadı. İlanın korunuyor."); return false; }
      },
      async setUserRole(userId, role) {
        const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";
        if (!isAdmin || userId === currentUser.id) return false; // kendi rolunu degistirme
        const prev = users.find((item) => item.id === userId)?.role;
        setUsers((items) => items.map((item) => (item.id === userId ? { ...item, role } : item)));
        if (!liveUser) return true;
        const ok = await settleWrite(updateUserRoleLive(userId, role));
        if (!ok) setUsers((items) => items.map((item) => (item.id === userId ? { ...item, role: prev } : item)));
        return ok;
      },
      async setUserStatus(userId, status) {
        const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";
        if (!isAdmin || userId === currentUser.id) return false;
        const prev = users.find((item) => item.id === userId)?.status;
        setUsers((items) => items.map((item) => (item.id === userId ? { ...item, status } : item)));
        if (!liveUser) return true;
        const ok = await settleWrite(updateUserStatusLive(userId, status));
        if (!ok) setUsers((items) => items.map((item) => (item.id === userId ? { ...item, status: prev } : item)));
        return ok;
      },
      async setUserVerification(userId, field, value) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return false;
        const prev = users.find((item) => item.id === userId)?.[field];
        setUsers((items) => items.map((item) => (item.id === userId ? { ...item, [field]: value } : item)));
        if (!liveUser) return true;
        const ok = await settleWrite(updateUserVerificationLive(userId, field, value));
        if (!ok) setUsers((items) => items.map((item) => (item.id === userId ? { ...item, [field]: prev } : item)));
        return ok;
      },
      async adminNotifyUser(userId, title, body) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff || !title.trim() || userId === currentUser.id) return false;
        // Sonuç ÇAĞIRANA döner: yönetici "gönderildi" bildirimini yalnız sunucu kabul edince görür.
        const notification: Notification = { id: newId("n", liveUser), userId, type: "system", title: title.trim(), body: body.trim(), read: false, createdAt: new Date().toISOString() };
        if (!liveUser) { setNotifications((items) => [notification, ...items]); return true; }
        return settleWrite(insertNotification(notification));
      },
      adminBroadcast(title, body) {
        const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";
        if (!isAdmin || !title.trim()) return;
        const targets = users.filter((u) => u.id !== currentUser.id && u.status !== "deleted" && isLiveUser(u));
        const now = new Date().toISOString().slice(0, 16).replace("T", " ");
        const rows = targets.map((u) => ({ id: newId("n", liveUser), userId: u.id, type: "system" as const, title: title.trim(), body: body.trim() }));
        setNotifications((items) => [
          ...rows.map((r) => ({ id: r.id, userId: r.userId, type: "system" as Notification["type"], title: r.title, body: r.body, read: false, createdAt: now })),
          ...items
        ]);
        if (liveUser) void insertBulkNotifications(rows);
      },
      updateSaleStatus(saleId, status, reason) {
        const sale = sales.find((item) => item.id === saleId);
        const saleListing = sale ? listings.find((item) => item.id === sale.listingId) : undefined;
        const salePartnership = sale ? partnerships.find((item) => item.id === sale.partnershipId) : undefined;
        const isSeller = saleListing?.ownerId === currentUser.id;
        const isPartner = salePartnership?.partnerId === currentUser.id;
        const sellerAction = status === "approved" || status === "seller_paid" || status === "cancelled";
        const partnerAction = status === "paid";
        // İtiraz (disputed) ve çözüm iki taraftan da açılabilir; diğer aksiyonlar role bağlı.
        // Personel (admin/moderatör) panelden her aksiyonu yürütebilir (anlaşmazlık çözümü/iptal).
        if (
          !sale ||
          (sellerAction && !isSeller && !staff) ||
          (partnerAction && !isPartner && !staff) ||
          (status === "disputed" && !isSeller && !isPartner && !staff)
        ) {
          return Promise.resolve(false);
        }
        // TERMİNAL DURUM: cancelled/paid personel dışında geri alınamaz — iptal edilen
        // ya da kapanan komisyon yeniden "ödenecek/onaylı" duruma sokulup metrikleri
        // ve panel sinyalini bozmasın.
        if (!staff && (sale.status === "cancelled" || sale.status === "paid") && status !== sale.status) {
          return Promise.resolve(false);
        }
        // Geçiş ön-koşulu: ortak "paid"i yalnızca satıcı ödeme bildirdikten (seller_paid)
        // veya anlaşmazlık (disputed) durumundan kapatabilir — açık/iade-penceresi
        // komisyonu erkenden kapatılamaz.
        if (!staff && partnerAction && sale.status !== "seller_paid" && sale.status !== "disputed") {
          return Promise.resolve(false);
        }
        const disputeText = reason?.trim() ? `Anlaşmazlık: ${reason.trim()}` : "Komisyon için anlaşmazlık kaydı açıldı.";
        const updatedSale = sale
          ? {
              ...sale,
              status,
              approvedAt: status === "approved" ? today() : sale.approvedAt,
              sellerMarkedPaidAt: status === "seller_paid" ? today() : sale.sellerMarkedPaidAt,
              partnerConfirmedPaidAt: status === "paid" ? today() : sale.partnerConfirmedPaidAt,
              paidAt: status === "paid" ? today() : sale.paidAt,
              payoutNote:
                status === "approved"
                  ? "İade penceresi kapandı, komisyon ödemeye hazır."
                  : status === "seller_paid"
                    ? "Satıcı komisyonu uygulama dışında ödediğini bildirdi. Ortak onayı bekleniyor."
                    : status === "paid"
                      ? "Satıcı ödedi, ortak ödemeyi aldığını onayladı."
                      : status === "cancelled"
                        ? "Satış veya komisyon iptal edildi."
                        : status === "disputed"
                          ? disputeText
                          : sale.payoutNote
            }
          : undefined;
        setSales((items) => items.map((item) => (item.id === saleId && updatedSale ? updatedSale : item)));
        // İptalde stoğu ve (satış yüzünden otomatik "sold" olduysa) ilan durumunu geri
        // al — aksi halde iptal edilen satış ilanı kalıcı "tükendi"de bırakıyordu.
        // Yalnızca cancelled'a İLK geçişte çalışır (çift-iade önlenir: terminal-guard
        // non-staff'i cancelled'dan çıkaramaz; staff re-cancel'de sale.status zaten cancelled).
        if (sale && status === "cancelled" && sale.status !== "cancelled" && saleListing) {
          const restoredStock = saleListing.stockCount + Math.max(1, Math.floor(sale.quantity ?? 1));
          const restoredStatus = saleListing.status === "sold" ? "active" : saleListing.status;
          const restoredListing: Listing = { ...saleListing, stockCount: restoredStock, status: restoredStatus };
          setListings((items) => items.map((item) => (item.id === saleListing.id ? restoredListing : item)));
          if (liveUser) void updateListingInventoryLive(restoredListing);
        }
        // NOT: payout bildirimlerine metadata (listingId+partnershipId) ŞART — yoksa
        // hrefForMeta null döner ve "ödemeyi aldığını onayla" bildirimi tıklanamaz
        // (para döngüsü ölü-uç olurdu). Metadata ile ortak→/partner, satıcı→/seller paneline gider.
        const payoutMeta = sale ? { listingId: sale.listingId, partnershipId: sale.partnershipId } : undefined;
        if (sale && status === "seller_paid") {
          const partnership = partnerships.find((item) => item.id === sale.partnershipId);
          if (partnership) notify(partnership.partnerId, "payout", "Komisyon ödendi bildirildi", `${sale.commissionAmount} TL için ödemeyi aldığını onayla.`, payoutMeta);
        }
        if (sale && status === "paid") {
          const listing = listings.find((item) => item.id === sale.listingId);
          if (listing) notify(listing.ownerId, "payout", "Ortak ödemeyi onayladı", `${sale.commissionAmount} TL komisyon kapandı.`, payoutMeta);
        }
        if (sale && status === "cancelled" && salePartnership) {
          notify(salePartnership.partnerId, "payout", "Satış/komisyon iptal edildi", `${saleListing?.title ?? "İlan"} için komisyon kaydı iptal edildi.`, payoutMeta);
        }
        if (sale && status === "disputed") {
          // İtirazı karşı tarafa bildir (kim açtıysa diğerine gider).
          const other = isSeller ? salePartnership?.partnerId : saleListing?.ownerId;
          if (other) notify(other, "payout", "Komisyon anlaşmazlığı açıldı", `${saleListing?.title ?? "İlan"} komisyonu için anlaşmazlık bildirildi. Panelden inceleyip çözebilirsin.`, payoutMeta);
        }
        if (!liveUser || !updatedSale) return Promise.resolve(true);
        // Sonuç çağırana da döner (yönetim paneli dürüst geri bildirim verir); diğer ekranlar
        // için hata yine görünür uyarıya (syncError) düşer ve iyimser değişiklik geri alınır.
        return settleWrite(updateSaleStatusLive(updatedSale)).then((ok) => {
          if (!ok) {
            setSales((items) => items.map((item) => (item.id === saleId ? sale : item)));
            setSyncError("Durum güncellemesi kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
          }
          return ok;
        });
      },
      recordBatchPayout(partnerId, listingId) {
        // Satıcı, bir ortağın (ops. tek ilan) BORÇLU komisyonlarını TEK toplu ödeme kaydıyla
        // seller_paid yapar (uygulama-dışı ödeme kaydı). Ortak yine "Ödemeyi Aldım" ile kapatır.
        const owed = sales.filter((s) => {
          const part = partnerships.find((p) => p.id === s.partnershipId);
          const l = listings.find((item) => item.id === s.listingId);
          return part?.partnerId === partnerId && l?.ownerId === currentUser.id
            && (!listingId || s.listingId === listingId)
            && (s.status === "return_pending" || s.status === "approved");
        });
        if (owed.length === 0) { setAuthError("Bu ortağa ödenecek (borçlu) komisyon yok."); return; }
        const prev = owed.map((s) => ({ id: s.id, status: s.status }));
        const owedIds = new Set(owed.map((s) => s.id));
        setSales((items) => items.map((s) => owedIds.has(s.id) ? { ...s, status: "seller_paid" as const, sellerMarkedPaidAt: today(), payoutNote: "Satıcı toplu ödeme kaydetti (uygulama dışı). Ortak onayı bekleniyor." } : s));
        setAuthError(undefined);
        notify(partnerId, "payout", "Komisyon ödemesi bildirildi", `${owed.length} satış için satıcı ödeme yaptığını bildirdi. Ödemeyi aldıysan onayla.`, listingId ? { listingId } : undefined);
        if (liveUser) persistCritical(recordPayoutLive(partnerId, listingId ?? null), () => {
          setSales((items) => items.map((s) => { const p = prev.find((x) => x.id === s.id); return p ? { ...s, status: p.status } : s; }));
        }, "Toplu ödeme kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
      },
      platformSettings,
      emailVerified,
      isSuspended,
      async updatePlatformSetting(key, value) {
        if (currentUser.role !== "admin" && currentUser.role !== "super_admin") return false;
        const before = platformSettings[key];
        setPlatformSettings((prev) => ({ ...prev, [key]: value }));
        const ok = await settleWrite(updatePlatformSettingLive(key, value));
        if (!ok) setPlatformSettings((prev) => ({ ...prev, [key]: before }));
        return ok;
      },
      async setAnnouncement(text, active) {
        if (currentUser.role !== "admin" && currentUser.role !== "super_admin") return false;
        const before = { announcement: platformSettings.announcement, announcementActive: platformSettings.announcementActive };
        setPlatformSettings((prev) => ({ ...prev, announcement: text, announcementActive: active }));
        const ok = await settleWrite(updateAnnouncementLive(text, active));
        if (!ok) setPlatformSettings((prev) => ({ ...prev, ...before }));
        return ok;
      },
      blogPosts,
      contentPages,
      seoSettings,
      saveBlogPost(post) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setBlogPosts((items) => [post, ...items.filter((x) => x.id !== post.id && x.slug !== post.slug)]);
        if (liveUser) void saveBlogPostLive(post);
      },
      deleteBlogPost(id) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setBlogPosts((items) => items.filter((x) => x.id !== id));
        if (liveUser) void deleteBlogPostLive(id);
      },
      saveContentPage(page) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setContentPages((items) => [page, ...items.filter((x) => x.slug !== page.slug)]);
        if (liveUser) void saveContentPageLive(page);
      },
      saveSeoSetting(setting) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setSeoSettings((items) => [setting, ...items.filter((x) => x.path !== setting.path)]);
        if (liveUser) void saveSeoSettingLive(setting);
      },
      // Temel (kod) ağaç + admin'in eklediği aktif ekstra kategoriler.
      categoryTree: [
        ...baseCategoryTree,
        ...extraCategories.filter((c) => c.isActive).map<CategoryNode>((c) => ({
          key: c.key,
          label: c.label,
          slug: c.slug || c.key,
          image: c.image || undefined,
          children: c.subcategories.length ? c.subcategories.map((s) => ({ key: `${c.key}-${s.slug || s.label}`, label: s.label, slug: s.slug || s.label })) : undefined
        }))
      ],
      extraCategories,
      saveCategory(c) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setExtraCategories((items) => [...items.filter((x) => x.id !== c.id && x.key !== c.key), c].sort((a, b) => a.sortOrder - b.sortOrder));
        if (liveUser) void saveCategoryLive(c);
      },
      deleteCategory(id) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        setExtraCategories((items) => items.filter((x) => x.id !== id));
        if (liveUser) void deleteCategoryLive(id);
      },
      hiddenCategories,
      toggleHiddenCategory(key) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff) return;
        const willHide = !hiddenCategories.includes(key);
        const next = willHide ? [...hiddenCategories, key] : hiddenCategories.filter((k) => k !== key);
        setHiddenCategoriesModule(next); // önce modül (topCategories anında doğru filtreler)
        setHiddenCategoriesState(next);  // sonra state (yeniden render tetikler)
        if (liveUser) void setHiddenCategoryLive(key, willHide);
      },
      importCategories(list) {
        const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
        if (!isStaff || list.length === 0) return 0;
        setExtraCategories((items) => {
          const byKey = new Map(items.map((x) => [x.key, x]));
          for (const c of list) byKey.set(c.key, c);
          return Array.from(byKey.values()).sort((a, b) => a.sortOrder - b.sortOrder);
        });
        if (liveUser) void bulkInsertCategoriesLive(list);
        return list.length;
      },
      marketplaceHasMore,
      marketplaceLoadingMore,
      marketplaceInitialLoading,
      accountLoaded,
      marketplaceLoadFailed,
      loadMoreMarketplace() {
        // BELLEK/DOM KORUMASI: sanallaştırma olmadan sonsuz kaydırma diziyi+düğümleri sınırsız
        // büyütüp sekmeyi dondurur/çökertir (milyonlarca ilanda). Bellekte tutulan katalog
        // ~MP_MAX ile sınırlı; sınıra gelince kullanıcı filtre/arama ile daraltır (Sahibinden'de
        // de sonsuz değil sayfalı gezinti vardır). Arama/filtre sunucu-taraflı olduğundan derinliğe
        // erişim kaybolmaz — yalnız tek seferde bellekte tutulan pencere sınırlıdır.
        const MP_MAX = 600;
        if (!isSupabaseConfigured || !marketplaceHasMore || marketplaceLoadingMore) return;
        if (mpOffsetRef.current >= MP_MAX) { setMarketplaceHasMore(false); return; }
        setMarketplaceLoadingMore(true);
        const PAGE = 60;
        const gen = mpGenRef.current; // refresh/retry bu sayacı artırırsa uçuştaki sonucu yok say
        void loadMarketplacePage(mpOffsetRef.current, PAGE)
          .then((page) => {
            if (!page || mpGenRef.current !== gen) return; // araya refresh girdi → offset kaymasını önle
            mpOffsetRef.current += page.listings.length;
            if (page.listings.length < PAGE || mpOffsetRef.current >= MP_MAX) setMarketplaceHasMore(false);
            if (page.listings.length) {
              setListings((items) => {
                const seen = new Set(items.map((l) => l.id));
                const fresh = page.listings.filter((l) => !seen.has(l.id));
                return fresh.length ? [...items, ...fresh] : items;
              });
              setUsers((items) => {
                const seen = new Set(items.map((u) => u.id));
                const fresh = page.users.filter((u) => !seen.has(u.id));
                return fresh.length ? [...items, ...fresh] : items;
              });
            }
          })
          .catch(() => { /* ağ hatası: mevcut liste korunur, spinner finally'de kapanır */ })
          .finally(() => setMarketplaceLoadingMore(false));
      },
      // Pull-to-refresh: ilk katalog snapshot'ını yeniden çeker (gerçek yeniden
      // yükleme — sahte gecikme/karıştırma yok). Önizleme modunda no-op.
      async refreshMarketplace() {
        if (!isSupabaseConfigured) return;
        mpGenRef.current += 1; // uçuştaki loadMore'u geçersiz kıl (yarış/offset kayması önlenir)
        const snapshot = await loadMarketplaceSnapshot();
        if (!snapshot) return;
        setMarketplaceLoadFailed(false);
        setUsers(snapshot.users);
        setListings(snapshot.listings);
        mpOffsetRef.current = snapshot.listings.length;
        setMarketplaceHasMore(snapshot.listings.length >= 90);
      },
      async refreshUserData() {
        const uid = currentUser?.id;
        if (!isSupabaseConfigured || !uid || !isAuthenticated) return;
        conversationContextAttempts.current.listings.clear();conversationContextAttempts.current.users.clear();
        const [account, refreshedOffers] = await Promise.all([loadAccountSnapshot(uid).catch(() => null), fetchOffersResultLive()]);
        // Yükleme sürerken çıkış yapıldı / hesap değişti → önceki hesabın özel verisini geri YAZMA.
        if (favoriteAccount.current !== uid) return;
        if (refreshedOffers) setOffers(refreshedOffers);
        if (!account) return;
        // Sorgusu BAŞARISIZ olan dilim yazılmaz (o dilim için önceki durum korunur): tek bir tablonun
        // zaman aşımı gelen kutusunu / bildirimleri / satışları boş listeyle ezmesin.
        const failed = account.failed ?? {};
        if (!failed.partnerships) setPartnerships(account.partnerships);
        if (!failed.leads) setLeads(account.leads);
        if (!failed.sales) setSales(account.sales);
        if (!failed.orders) setOrders(account.orders);
        if (!failed.reviews) setReviews((items) => [...account.reviews, ...items.filter((item) => item.reviewerId !== uid && item.reviewedUserId !== uid)]);
        if (!failed.favorites) setFavorites(account.favorites);
        if (!failed.conversations) setConversations((items) => mergeServerConversations(account.conversations, items));
        if (!failed.messages) setMessages((items) => mergeServerMessages(account.messages, items));
        if (!failed.notifications) setNotifications(account.notifications.map((n) => (notificationWrites.current.has(n.id) ? { ...n, read: true } : n)));
        if (!failed.reports) setReports(account.reports);
      },
      // İlk yükleme başarısızsa "Yeniden dene" düğmesinin çağırdığı retry: skeleton'ı
      // tekrar aç, snapshot'ı yeniden çek; yine başarısızsa fail durumunu koru.
      async retryMarketplace() {
        if (!isSupabaseConfigured) return;
        mpGenRef.current += 1; // uçuştaki loadMore'u geçersiz kıl
        setMarketplaceInitialLoading(true);
        setMarketplaceLoadFailed(false);
        try {
          const snapshot = await loadMarketplaceSnapshot();
          if (!snapshot) { setMarketplaceLoadFailed(true); return; }
          setUsers(snapshot.users);
          setListings(snapshot.listings);
          mpOffsetRef.current = snapshot.listings.length;
          setMarketplaceHasMore(snapshot.listings.length >= 90);
          setBackendMode("supabase");
        } catch {
          setMarketplaceLoadFailed(true);
        } finally {
          setMarketplaceInitialLoading(false);
        }
      },
      findConversation(id) {
        // Yerel id sunucudaki mevcut konuşmaya eşlendiyse (bkz. createOrReuseConversation) onu döndür.
        return conversationById.get(id) ?? conversationById.get(conversationAlias.current.get(id) ?? "");
      },
      findListing(id) {
        return listingById.get(id);
      },
      findUser(id) {
        return userById.get(id);
      },
      findPartnership(listingId, partnerId = currentUser.id) {
        return partnerships.find((item) => item.listingId === listingId && item.partnerId === partnerId);
      },
      isFavorite(listingId) {
        return favorites.some((item) => item.listingId === listingId && item.userId === currentUser.id);
      }
    };
  }, [authError, authReady, authUser, backendMode, blogPosts, contentPages, conversations, emailVerified, extraCategories, hiddenCategories, favorites, leads, listings, marketplaceHasMore, marketplaceLoadingMore, marketplaceInitialLoading, accountLoaded, marketplaceLoadFailed, messages, notifications, offers, orders, partnerships, pendingVerifyEmail, platformSettings, reports, reviews, sales, seoSettings, syncError, users]);

  // Hafif favori-önbelleğini app-store ile senkronla (kart favori kalbi için).
  const favToggleRef = useRef<(id: string) => void>(() => {});
  favToggleRef.current = value.toggleFavorite;
  useEffect(() => { registerFavoriteToggle((id) => favToggleRef.current(id)); }, []);
  useEffect(() => {
    syncFavorites(favorites.filter((f) => f.userId === currentUserId).map((f) => f.listingId));
  }, [favorites, currentUserId]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
















